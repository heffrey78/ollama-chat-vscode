import { homedir } from "os";
import * as uuid from "uuid";
import { executeTool } from './tools/executables';
import { Orchestrator } from "./orchestrator";
import { logger } from './logger';
import { Message } from "./messages/message";
import { MessageType } from "./messages/messageType";
import { ToolCall } from "./pipelines/toolCall";

export interface Objective {
  objective: string;
}

export interface State extends Map<string, string> {}

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

  constructor(messageHandler: Orchestrator) {
    this.orchestrator = messageHandler;
    this.pipelines = [];
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
    if (Array.isArray(toolArray) && toolArray.every(item => this.isToolCall(item))) {
      const pipeline: Pipeline = {
        name: 'Toolcalls',
        directoryName: homedir(),
        state: new Map<string, string>(),
        objectives: undefined,
        toolCalls: toolArray
      };
      logger.info(`Created new pipeline 'Toolcalls' with ${toolArray.length} tool calls`);
      return pipeline;
    }
    throw new Error('Pipeline was unable to be created');
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

    logger.info(`Executing pipeline ${pipeline.name}`);
    if (pipeline) {
      while (pipeline.toolCalls.length > 0) {
        const task = pipeline.toolCalls.shift();
        if (task && !pipeline.toolCalls.find(x => x.id === task.id)) {
          try {
            const result = await this.executeToolCall(pipeline, task);
            results.push(result);
            this.orchestrator.sendUpdateToPanel(`Called: ${task.function.name} with arguments ${JSON.stringify(task.function.arguments)}. \n\n The result was ${result}`);
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

    logger.info(`Pipeline ${pipeline.name} execution completed`);
    this.displayPipeline();
    return results;
  }

  async executeAdhocToolCall(toolName: string, args: { [key: string]: any }): Promise<any> {
    const toolCall = this.generateToolCall(toolName, args);
    const pipeline = this.createPipeline([toolCall]);
    return await this.executeToolCall(pipeline, toolCall);
  }

  // Pipeline Generation
  async generatePipelinePart(pipelinePrompt: string): Promise<any> {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        const pipelineJson = JSON.parse(pipelinePrompt);

        if(pipelineJson.attempts) {
          pipelineJson.attempts = retryCount;
        }

        const pipelinePartMessage: Message = this.createGenerateMessage(JSON.stringify(pipelineJson));
        logger.info(`Generating pipeline part, attempt ${retryCount + 1}`);
        const pipelineResponse = await this.orchestrator.handleMessage(pipelinePartMessage);

        const { success, json } = await this.tryParseJson(pipelineResponse.content);
        if (success) {
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
    const args = toolCall.function.arguments ? this.updateArgumentsFromState(pipeline, JSON.stringify(toolCall.function.arguments)) : "";
    logger.info(`Executing tool call: ${toolCall.function.name}`);
    return await executeTool(toolCall.function.name, JSON.parse(args), pipeline.state, this.orchestrator, this);
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

  private async tryParseJson(response: string): Promise<{ success: boolean; json?: any }> {
    let trimmedResponse = response.trim().replace(/^[^{\[]+|[^}\]]+$/g, '');
    const jsonRegex = /(\{[\s\S]*?\}|\[[\s\S]*?\])/g;
    const matches = trimmedResponse.match(jsonRegex);
    if (matches) {
      trimmedResponse = matches.join('');
      //trimmedResponse = matches.reduce((a, b) => a.length > b.length ? a : b);
    }
    trimmedResponse = this.balanceBracketsAndBraces(trimmedResponse);
    trimmedResponse = this.fixEncodingIssues(trimmedResponse);

    try {
      const json = JSON.parse(trimmedResponse);
      logger.info('Successfully parsed JSON response');
      return { success: true, json };
    } catch (error) {
      logger.error(`Error parsing JSON: ${this.getErrorMessage(error)}`);
      this.orchestrator.sendErrorToPanel(`Error creating pipeline: ${this.getErrorMessage(error)}`);
      return { success: false };
    }
  }

  private balanceBracketsAndBraces(str: string): string {
    const stack: string[] = [];
    const open: Record<string, string> = {'{': '}', '[': ']'};
    const close: Record<string, string> = {'}': '{', ']': '['};
    let balanced = str;

    for (const char of str) {
      if (char in open) {
        stack.push(char);
      } else if (char in close) {
        if (stack.length === 0 || stack[stack.length - 1] !== close[char]) {
          stack.push(close[char]);
          balanced = close[char] + balanced;
        } else {
          stack.pop();
        }
      }
    }

    while (stack.length > 0) {
      const char = stack.pop()!;
      balanced += open[char];
    }
  
    return balanced;
  }

  private fixEncodingIssues(str: string): string {
    return str
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, '...')
      .replace(/\u2013/g, '-')
      .replace(/\u2014/g, '--')
      .replace(/\u00A0/g, ' ');
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

    const output: string[] =  [`| ${headerRow} |`, `| ${separatorRow} |`];
    rows.map(row => 
      output.push(`| ${row.map((cell, index) => String(cell).padEnd(maxWidths[index])).join(" | ")} |`
    ));

    output.forEach(line => this.orchestrator.sendUpdateToPanel(line));
  }

  private lastErrorMessage: string = '';
}