import { homedir } from "os";
import * as uuid from "uuid";
import { executeTool } from './tools/executables';
import { Orchestrator } from "./orchestrator";
import { logger } from './logger';
import { Message } from "./messages/message";
import { MessageType } from "./messages/messageType";
import { ToolCall } from "./pipelines/toolCall";
import { MessageTools } from "./messages/messageTools";
import { pipeline } from "stream";

export interface Objective {
  objective: string;
}

export interface State extends Map<string, string> { }

export interface Pipeline {
  name: string;
  directoryName: string;
  state: State;
  objectives: Objective[] | undefined;
  toolCalls: ToolCall[];
}

export class PipelineHandler {
  private orchestrator: Orchestrator;
  private pipelines: Pipeline[];
  private messageTools: MessageTools;

  constructor(messageHandler: Orchestrator) {
    this.orchestrator = messageHandler;
    this.pipelines = [];
    this.messageTools = new MessageTools();
    logger.info('PipelineHandler initialized');
  }

  // Pipeline Management
  addPipeline(pipeline: Pipeline): void {
    this.pipelines.push(pipeline);
    this.displayPipeline();
    logger.info(`Added pipeline: ${pipeline.name}`);
  }

  getPipeline(name: string): Pipeline {
    const pipeline = this.pipelines.find(x => x.name === name);
    if (!pipeline) {
      logger.error(`Pipeline ${name} does not exist`);
      throw new Error(`Pipeline ${name} does not exist.`);
    }
    logger.info(`Retrieved pipeline ${name}`);
    return pipeline;
  }

  createPipeline(toolArray: ToolCall[]): Pipeline {
    if (!Array.isArray(toolArray)) {
      throw new Error('Input must be an array of ToolCalls');
    }

    if (!toolArray.every(item => this.isToolCall(item))) {
      throw new Error('All items in the array must be valid ToolCalls');
    }

    const pipeline: Pipeline = {
      name: `Toolcalls-${new Date().toISOString()}`, // Add timestamp to name for uniqueness
      directoryName: homedir(),
      state: new Map<string, string>(),
      objectives: [],
      toolCalls: toolArray,
    };

    logger.info(`Created new pipeline '${pipeline.name}' with ${toolArray.length} tool calls`);
    return pipeline;
  }

  createAndAddPipeline(toolArray: ToolCall[]): Pipeline {
    const pipeline = this.createPipeline(toolArray);
    this.addPipeline(pipeline);
    return pipeline;
  }

  clearPipelines(): void {
    this.pipelines = [];
    logger.info('Cleared all pipelines');
  }

  getPipelinesLength(): number {
    return this.pipelines.length;
  }

  getToolCallsLength(): number {
    let toolCallsLength = 0;
    this.pipelines.map(x => x.toolCalls.length).forEach(x => toolCallsLength += x);
    return toolCallsLength;
  }

  // Tool Call Management
  addToolCalls(pipeline: Pipeline, newToolCalls: ToolCall | ToolCall[]): void {
    const toolCallsToAdd = Array.isArray(newToolCalls) ? newToolCalls : [newToolCalls];
    for (const toolCall of toolCallsToAdd) {
      toolCall.id = toolCall.id || uuid.v4();
    }
    pipeline.toolCalls.unshift(...toolCallsToAdd);
    logger.info(`Added ${toolCallsToAdd.length} tool calls to pipeline ${pipeline.name}`);
  }

  getToolCalls(pipeline: Pipeline): ToolCall[] {
    logger.info(`Getting tool calls for pipeline ${pipeline.name}`);
    return pipeline.toolCalls;
  }

  // Pipeline Execution
  async executePipeline(pipeline: Pipeline): Promise<any[]> {
    const results: any[] = [];
    const processedToolCalls: ToolCall[] = [];
    try {
      logger.info(`Executing pipeline ${pipeline.name}`);
      if (pipeline) {
        while (pipeline.toolCalls.length > 0) {
          const task = pipeline.toolCalls.shift();
          if (task && !pipeline.toolCalls.find(x => x.id === task.id)) {
            try {
              const result = await this.executeToolCall(pipeline, task);
              results.push(result);
              this.orchestrator.sendUpdateToPanel(`Called: ${task.function.name} with arguments ${JSON.stringify(task.function.arguments)}. \n\n The result was ${JSON.stringify(result)}`);
              this.updateState(pipeline, task.function.name, result);
              this.handleExecutionResult(result);
            } catch (error) {
              this.handleExecutionError(task, error);
            } finally {
              processedToolCalls.push(task);
            }
          }
        }

      }
    } catch (error) {
      this.handlePipelineError(pipeline, error);
    }

    this.removePipeline(pipeline);
    logger.info(`Pipeline ${pipeline.name} execution completed`);
    this.displayPipeline();
    return results;
  }

  async executeAdhocToolCall(toolName: string, args: { [key: string]: any }): Promise<any> {
    const toolCall = this.generateToolCall(toolName, args);
    const pipeline = this.createPipeline([toolCall]);
    const result = await this.executeToolCall(pipeline, toolCall);
    this.removePipeline(pipeline);
    return result;
  }

  // Pipeline Generation
  async generatePipelinePart(pipelinePrompt: string): Promise<any> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const pipelineJsonParse = await this.messageTools.multiAttemptJsonParse(pipelinePrompt); // await this.messageTools.tryParseJson(pipelinePrompt);

        if (pipelineJsonParse && pipelineJsonParse.attempts) {
          pipelineJsonParse.attempts = retryCount;
        }

        const pipelinePartMessage: Message = this.createGenerateMessage(JSON.stringify(pipelineJsonParse));
        logger.info(`Generating pipeline part, attempt ${retryCount + 1}`);
        const pipelineResponse = await this.orchestrator.handleMessage(pipelinePartMessage);

        const json = await this.messageTools.multiAttemptJsonParse(pipelineResponse.content); // await this.messageTools.tryParseJson(pipelineResponse.content);
        if (json) {
          logger.info('Successfully generated pipeline part');
          return json;
        }
      } catch (error) {
        this.handleGenerationError(error, retryCount, maxRetries);
      }

      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.error('Failed to parse plan');
    throw new Error('Failed to parse plan');
  }

  // Utility Methods
  private isToolCall(obj: any): obj is ToolCall {
    return obj && typeof obj === 'object' && obj.function && typeof obj.function.name === 'string';
  }

  private isPipeline(obj: any): obj is Pipeline {
    return obj && typeof obj === 'object' && typeof obj.name === 'string' && typeof obj.directoryName === 'string' && Array.isArray(obj.toolCalls);
  }

  private removePipeline(pipeline: Pipeline) {
    this.pipelines = Array.from(this.pipelines).filter(item => item !== pipeline);
  }

  private generateToolCall(toolName: string, args: { [key: string]: any }): ToolCall {
    return {
      id: uuid.v4(),
      type: 'function',
      function: {
        name: toolName,
        arguments: args
      }
    };
  }

  private async executeToolCall(pipeline: Pipeline, toolCall: ToolCall): Promise<any> {
    try {
      const args = toolCall.function.arguments ? this.updateArgumentsFromState(pipeline, JSON.stringify(toolCall.function.arguments)) : "";
      logger.info(`Executing tool call: ${toolCall.function.name}`);
      return await executeTool(toolCall.function.name, JSON.parse(args), pipeline.state, this.orchestrator, this);
    } catch (error) {
      logger.error(`Error occurred while executing tool call: ${this.getErrorMessage(error)}`);
      throw error;
    }
  }

  private updateArgumentsFromState(pipeline: Pipeline, args: string): string {
    let replacedArgs = args;
    try {
      for (const [key, value] of pipeline.state.entries()) {
        if (typeof value === 'string' && args.includes(`{${key}}`)) {
          replacedArgs = replacedArgs.replace(`{${key}}`, JSON.stringify(value));
        } else {
          logger.warn(`Invalid or non-string state variable found for key "${key}"`);
        }
      }
    } catch (error) {
      logger.error(`Error occurred while replacing state variables: ${this.getErrorMessage(error)}`);
      throw error;
    }
    return replacedArgs;
  }

  private updateState(pipeline: Pipeline, toolName: string, result: any): void {
    pipeline.state.set(toolName, result);
    logger.info(`Updated state for pipeline ${pipeline.name}, tool: ${toolName}`);
  }

  private handleExecutionResult(result: any): void {
    if (this.isPipeline(result)) {
      const newPipeline: Pipeline = result;
      newPipeline.state.set('pipelineName', result.name);
      newPipeline.state.set('directoryName', result.directoryName);
      this.addToolCalls(newPipeline, result.toolCalls);
      logger.info(`Created new pipeline from result: ${newPipeline.name}`);
    } else if (Array.isArray(result) && result.every(item => this.isToolCall(item))) {
      const adhocPipeline: Pipeline = this.createPipeline(result);
      this.addPipeline(adhocPipeline);
      logger.info(`Created new ad-hoc pipeline with ${result.length} tool calls`);
    }
  }

  private handlePipelineError(pipeline: Pipeline, error: unknown) {
    logger.error(`Error executing tool call "${pipeline.name}": ${this.getErrorMessage(error)}`);
    this.orchestrator.sendUpdateToPanel(`Error executing tool call "${pipeline.name}": \n\n ${error}`);
  }

  private handleExecutionError(task: ToolCall, error: unknown): void {
    logger.error(`Error executing tool call "${task.function.name}": ${this.getErrorMessage(error)}`);
    this.orchestrator.sendUpdateToPanel(`Error executing tool call "${task.function.name}": \n\n ${error}`);
  }

  private handleGenerationError(error: unknown, retryCount: number, maxRetries: number): void {
    if (error instanceof SyntaxError) {
      this.lastErrorMessage = error.message;
      logger.error(`JSON parse error: ${this.lastErrorMessage}`);
    } else {
      logger.error(`Unexpected error: ${this.getErrorMessage(error)}`);
      throw error;
    }

    if (retryCount === maxRetries - 1) {
      logger.error(`Failed to receive valid JSON after ${maxRetries} retries`);
      throw new Error(`Failed to receive valid JSON after ${maxRetries} retries.`);
    }
  }

  private createGenerateMessage(pipelinePrompt: string): Message {
    return {
      role: 'system',
      command: MessageType.Generate,
      content: pipelinePrompt,
      tool_use: false
    };
  }


  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  public displayPipeline(): void {
    if (this.pipelines.length === 0) {
      this.orchestrator.sendUpdateToPanel("No pipelines to display.");
      return;
    }

    const headers = ["Pipeline Name", "Directory Name", "Tool Name", "Tool Arguments"];
    const rows: string[][] = this.pipelines.flatMap(pipeline =>
      pipeline.toolCalls.map(toolCall => [
        pipeline.name,
        pipeline.directoryName,
        toolCall.function.name,
        JSON.stringify(toolCall.function.arguments)
      ])
    );

    const maxWidths = headers.map((header, index) =>
      Math.max(header.length, ...rows.map(row => String(row[index]).length))
    );

    const headerRow = headers.map((header, index) => header.padEnd(maxWidths[index])).join(" | ");
    const separatorRow = maxWidths.map(width => "-".repeat(width)).join("-+-");

    const output: string[] = [`| ${headerRow} |`, `| ${separatorRow} |`];
    rows.map(row =>
      output.push(`| ${row.map((cell, index) => String(cell).padEnd(maxWidths[index])).join(" | ")} |`
      ));

    output.forEach(line => this.orchestrator.sendUpdateToPanel(line));
  }

  private lastErrorMessage: string = '';
}

