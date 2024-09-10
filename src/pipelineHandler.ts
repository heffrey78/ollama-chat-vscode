import { homedir } from "os";
import * as uuid from "uuid";
import { executeTool } from './tools/executables';
import { Orchestrator } from "./orchestrator";
import { logger } from './logger';
import { ChatRequest } from "./chats/chatRequest";

export interface Objective {
  objective: string;
}

export interface State extends Map<string, string> { }

export interface Pipeline {
  name: string;
  directoryName: string;
  state: State;
  objectives: Objective[] | undefined;
  tasks: ToolCall[];
}

export class PipelineHandler {
  public orchestrator: Orchestrator;
  public pipelines: Pipeline[];

  constructor(messageHandler: Orchestrator) {
    this.orchestrator = messageHandler;
    this.pipelines = [];
    logger.info('PipelineHandler initialized');
  }

  addToolCalls(pipeline: Pipeline, newToolCalls: ToolCall | ToolCall[]) {
    const toolCallsToAdd = Array.isArray(newToolCalls) ? newToolCalls : [newToolCalls];
    for (const toolCall of toolCallsToAdd) {
      toolCall.id = toolCall.id || uuid.v4();
    }
    pipeline.tasks.unshift(...toolCallsToAdd);
    logger.info(`Added ${toolCallsToAdd.length} tool calls to pipeline ${pipeline.name}`);
  }

  getToolCalls(pipeLine: Pipeline): ToolCall[] {
    logger.info(`Getting tool calls for pipeline ${pipeLine.name}`);
    return pipeLine.tasks;
  }

  getPipeline(name: string): Pipeline {
    const pipeline = this.pipelines.find(x => x.name == name);

    if (!pipeline || pipeline == undefined) {
      logger.error(`Pipeline ${name} does not exist`);
      throw new Error(`Pipeline ${name} does not exist.`);
    }

    logger.info(`Retrieved pipeline ${name}`);
    return pipeline;
  }

  createPipeline(toolArray: ToolCall[]) {
    if (Array.isArray(toolArray) && toolArray.every(item => this.isToolCall(item))) {
      const pipeline: Pipeline = {
        name: 'Toolcalls',
        directoryName: homedir.toString(),
        state: new Map<string, string>(),
        objectives: undefined,
        tasks: toolArray
      };
      this.pipelines.push(pipeline);
      logger.info(`Created new pipeline 'Toolcalls' with ${toolArray.length} tool calls`);
    }
  }

  async generatePipelinePart(pipelinePrompt: string): Promise<any> {
    const maxRetries = 3;
    let retryCount = 0;
    let pipelineJson = {};
    let errorMessage: string = "";

    while (retryCount < maxRetries) {
      try {
        const failureReply: string = retryCount > 0 ? `Attempt #${retryCount + 1}. Error from JSON.parse when trying to parse previous response: ${errorMessage}` : ""
        const pipelineMessage = { command: 'sendMessage', text: pipelinePrompt + failureReply, tool_use: false };
        logger.info(`Generating pipeline part, attempt ${retryCount + 1}`);
        const pipelineResponse = await this.orchestrator.handleMessage(pipelineMessage);
        const trimmedResponse = await this.tryParseJson(pipelineResponse.content);
        pipelineJson = trimmedResponse.json;

        logger.info('Successfully generated pipeline part');
        break;
      } catch (error) {
        if (error instanceof SyntaxError) {
          errorMessage = error.message;
          logger.error(`JSON parse error: ${errorMessage}`);
        }

        if (!(error instanceof SyntaxError)) {
          logger.error(`Unexpected error: ${this.getErrorMessage(error)}`);
          throw error;
        }

        retryCount++;

        if (retryCount === maxRetries) {
          logger.error(`Failed to receive valid JSON after ${maxRetries} retries`);
          throw new Error(`Failed to receive valid JSON after ${maxRetries} retries.`);
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (pipelineJson) {
      return pipelineJson;
    } else {
      logger.error('Failed to parse plan');
      throw new Error('Failed to parse plan');
    }
  }

  private async tryParseJson(response: string): Promise<{ success: boolean; json?: any }> {
    let trimmedResponse = response.trim();
    const jsonRegex = /(\{[\s\S]*?\}|\[[\s\S]*?\])/g;
  
    const matches = trimmedResponse.match(jsonRegex);
    if (matches) {
      // Find the longest JSON string
      trimmedResponse = matches.reduce((a, b) => a.length > b.length ? a : b);
    } else {
      trimmedResponse = trimmedResponse.replace(/^[^\{\[]+|[^\}\]]+$/, '');
    }
  
    try {
      const json = JSON.parse(trimmedResponse);
      logger.info('Successfully parsed JSON response');
      return { success: true, json };
    } catch (error) {
      logger.error(`Error parsing JSON: ${this.getErrorMessage(error)}`);
      this.orchestrator.sendErrorToPanel(`Error creating pipeline: ${this.getErrorMessage(error)}`);
  
      // Call LLM for parsing improvement suggestions
      try {
        const errorMessage = this.getErrorMessage(error);
        const stackTrace = error instanceof Error ? error.stack : 'No stack trace available';
        const messageContent = `I encountered an error while parsing JSON: "${errorMessage}". Here's the stack trace: ${stackTrace}. Can you suggest improvements to the parsing method or identify potential issues with the JSON string?`;
        

        const chatToolCall: ToolCall = {
          id: uuid.v4(),
          type: "function",
          function: {
              name: 'chat',
              arguments: { message: messageContent }
          }
      };

        this.createPipeline([chatToolCall]);
        if(this.pipelines.length == 1) {
          await this.executePipelines();
        }
      } catch (llmError) {
        logger.error(`Error getting LLM suggestion: ${this.getErrorMessage(llmError)}`);
      }
  
      return { success: false };
    }
  }
  

  async executePipeline(pipeline: Pipeline): Promise<any[]> {
    const results: any[] = [];
    const processedToolCalls: ToolCall[] = [];

    logger.info(`Executing pipeline ${pipeline.name}`);
    if (pipeline != undefined) {
      while (pipeline.tasks.length > 0) {
        const task = pipeline.tasks.shift();
        if (task && !pipeline.tasks.find(x => x.id === task.id)) {
          try {
            logger.info(`Executing tool call: ${task.function.name}`);
            const result = await this.executeToolCall(pipeline, task);
            results.push(result);
            this.orchestrator.sendUpdateToPanel(`Called: ${task.function.name} with arguments ${JSON.stringify(task.function.arguments)}. \n\n The result was ${result}`);

            this.updateState(pipeline, task.function.name, result);

            if (this.isPipeline(result)) {
              const newPipeline: Pipeline = result;
              newPipeline.state.set('pipelineName', result.name);
              newPipeline.state.set('directoryName', result.directoryName);

              this.addToolCalls(newPipeline, result.tasks);
              logger.info(`Created new pipeline from result: ${newPipeline.name}`);
            } else if (Array.isArray(result) && result.every(item => this.isToolCall(item))) {
              const adhocPipeline: Pipeline = {
                name: 'Toolcalls',
                directoryName: homedir.toString(),
                state: new Map<string, string>(),
                objectives: undefined,
                tasks: result
              };
              this.pipelines.push(adhocPipeline);
              logger.info(`Created new ad-hoc pipeline with ${result.length} tool calls`);
            }
          } catch (error) {
            logger.error(`Error executing tool call "${task.function.name}": ${this.getErrorMessage(error)}`);
            this.orchestrator.sendUpdateToPanel(`Error executing tool call "${task.function.name}": \n\n ${error}`);
          } finally {
            processedToolCalls.push(task);
          }
        }
      }
    }

    logger.info(`Pipeline ${pipeline.name} execution completed`);
    return results;
  }

  async executePipelines(): Promise<void> {
    logger.info('Executing all pipelines');
    while (this.pipelines.length > 0) {
      const pipeline = this.pipelines.shift();
      if (pipeline) {
        await this.executePipeline(pipeline);
      }
    }
    logger.info('All pipelines executed');
  }

  private isToolCall(obj: any): obj is ToolCall {
    return obj && typeof obj === 'object' && obj.function && typeof obj.function.name === 'string';
  }

  private isPipeline(obj: any): obj is Pipeline {
    return obj && typeof obj === 'object' && typeof obj.name === 'string' && typeof obj.directoryName === 'string' && Array.isArray(obj.tasks);
  }

  private async executeToolCall(pipeLine: Pipeline, toolCall: ToolCall): Promise<any> {
    const args = toolCall.function.arguments ? this.updateArgumentsFromState(pipeLine, JSON.stringify(toolCall.function.arguments)) : "";

    logger.info(`Executing tool call: ${toolCall.function.name}`);
    return await executeTool(toolCall.function.name, JSON.parse(args), pipeLine.state, this.orchestrator, this);
  }

  private updateArgumentsFromState(pipeline: Pipeline, args: string): string {
    let replacedArgs = args;
    try {
      for (const entry of pipeline.state) {
        if (entry && typeof entry[1] === 'string' && args.includes(`{${entry[0]}}`)) {
          replacedArgs = replacedArgs.replace(`{${entry[0]}}`, JSON.stringify(entry[1]));
        } else {
          logger.warn(`Invalid or non-string state variable found for key "${entry[0]}"`);
        }
      }
    } catch (error) {
      logger.error(`Error occurred while replacing state variables: ${this.getErrorMessage(error)}`);
      throw error;
    }

    return replacedArgs;
  }

  private updateState(pipeline: Pipeline, toolName: string, result: any) {
    pipeline.state.set(toolName, result);
    logger.info(`Updated state for pipeline ${pipeline.name}, tool: ${toolName}`);
  }

  clearPipelines() {
    this.pipelines = [];
    logger.info('Cleared all pipelines');
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}
