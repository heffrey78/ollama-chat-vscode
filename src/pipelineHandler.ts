import * as uuid from "uuid";
import { handleToolCall } from './toolHandlers';
import { MessageHandler } from "./messageHandler";

export interface ToolCall {
    id?: string;
    type?: 'function';
    function: {
        name: string;
        arguments: { [key: string]: any };
    };
}

export interface Objective {
    objective: string;
}

export interface State extends Map<string, string> {}

export interface Pipeline {
    name: string;
    directoryName: string;
    state: State;
    objective: Objective[];
    tasks: ToolCall[];
}

export class PipelineHandler {
    private toolCalls: ToolCall[];
    private state: Map<string, any>;
    public messageHandler: MessageHandler;

    constructor(messageHandler: MessageHandler) {
        this.toolCalls = [];
        this.state = new Map();
        this.messageHandler = messageHandler;
    }

    addToolCall(toolCall: ToolCall) {
        toolCall.id = toolCall.id || uuid.v4();
        this.toolCalls.push(toolCall);
    }

    async executePipeline(cwd: string): Promise<any[]> {
        const results: any[] = [];
        let processedToolCalls: ToolCall[] = [];
      
        while (this.toolCalls.length > 0) {
          const toolCall = this.toolCalls.shift();
          if (toolCall && !processedToolCalls.find(x => x.id == toolCall.id)) {
            try {
              const result = await this.executeToolCall(toolCall, cwd);
              results.push(result);
              this.messageHandler.updateUser(`Called: ${toolCall.function.name} with arguments ${JSON.stringify(toolCall.function.arguments)}. \n\n The result was ${result}`);
      
              // Update state and process pipeline or tool call array results
              this.updateState(toolCall.function.name, result);
      
              if (this.isPipeline(result)) {
                this.state.set('pipelineName', result.name);
                this.state.set('directoryName', result.directoryName);
                for (const task of result.tasks) {
                  this.addToolCall(task);
                }
              } else if (Array.isArray(result) && result.every(item => this.isToolCall(item))) {
                for (const newToolCall of result) {
                  this.addToolCall(newToolCall);
                }
              }
            } catch (error) {
                this.messageHandler.updateUser(`Error executing tool call "${toolCall.function.name}": \n\n ${error}`);
            } finally {
                processedToolCalls.push(toolCall);
            }
          }
        }
      
        return results;
      }
      
    private isToolCall(obj: any): obj is ToolCall {
        return obj && typeof obj === 'object' && obj.function && typeof obj.function.name === 'string';
    }

    private isPipeline(obj: any): obj is Pipeline {
        return obj && typeof obj === 'object' && typeof obj.name === 'string' && typeof obj.directoryName === 'string' && Array.isArray(obj.tasks);
    }

    private async executeToolCall(toolCall: ToolCall, cwd: string): Promise<any> {
        const args = toolCall.function.arguments ? this.updateArgumentsFromState(JSON.stringify(toolCall.function.arguments)) : "";
        
        return await handleToolCall(toolCall.function.name, JSON.parse(args), cwd, this.state, this.messageHandler);
    }

    private updateArgumentsFromState(args: string): string {
        let replacedArgs = args;
        try {
          for (const entry of this.state) {
            // Check if the key exists in the arguments and is of type string before replacing
            if (entry && typeof entry[1] === 'string' && args.includes(`{${entry[0]}}`)) {
              replacedArgs = replacedArgs.replace(`{${entry[0]}}`, JSON.stringify(entry[1]));
            } else {
              console.error(`Invalid or non-string state variable found for key "${entry[0]}"`);
            }
          }
        } catch (error) {
          console.error("Error occurred while replacing state variables:", error);
          throw error; // Re-throw the error after logging to preserve the original error stack trace
        }
      
        return replacedArgs;
      }

    private updateState(toolName: string, result: any) {
        this.state.set(toolName, result);
    }

    clearPipeline() {
        this.toolCalls = [];
        this.state.clear();
    }
}
