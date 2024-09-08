"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineHandler = void 0;
const uuid = __importStar(require("uuid"));
const executables_1 = require("./executables");
class PipelineHandler {
    constructor(messageHandler) {
        this.toolCalls = [];
        this.state = new Map();
        this.orchestrator = messageHandler;
    }
    addToolCalls(newToolCalls) {
        const toolCallsToAdd = Array.isArray(newToolCalls) ? newToolCalls : [newToolCalls];
        for (const toolCall of toolCallsToAdd) {
            toolCall.id = toolCall.id || uuid.v4();
        }
        this.toolCalls.unshift(...toolCallsToAdd);
    }
    getToolCalls() {
        return this.toolCalls;
    }
    async generatePipelinePart(pipelinePrompt) {
        const maxRetries = 3;
        let retryCount = 0;
        let pipelineJson = {};
        let errorMessage = "";
        while (retryCount < maxRetries) {
            try {
                const failureReply = retryCount > 0 ? `Attempt #${retryCount + 1}. Error from JSON.parse when trying to parse previous response: ${errorMessage}` : "";
                const pipelineMessage = { command: 'sendMessage', text: pipelinePrompt + failureReply, tool_use: false };
                const pipelineResponse = await this.orchestrator.handleMessage(pipelineMessage);
                const trimmedResponse = this.tryParseJson(pipelineResponse.content);
                pipelineJson = trimmedResponse.json;
                // If we reach this point, the response is valid JSON, so break out of the loop.
                break;
            }
            catch (error) {
                if (error instanceof SyntaxError) {
                    errorMessage = error.message;
                }
                if (!(error instanceof SyntaxError)) {
                    // If the error is not due to invalid JSON, rethrow it.        
                    throw error;
                }
                retryCount++;
                if (retryCount === maxRetries) {
                    throw new Error(`Failed to receive valid JSON after ${maxRetries} retries.`);
                }
                // Wait for a short duration before retrying to avoid overwhelming the server.
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        if (pipelineJson) {
            return pipelineJson; // Return the entire plan object
        }
        else {
            throw new Error('Failed to parse plan');
        }
    }
    tryParseJson(response) {
        // we need to remove the characters after the last } as well
        let trimmedResponse = response.trim();
        const jsonRegex = /^(\{|\[])([\s\S]*?)(\}|])$/;
        if (!jsonRegex.test(trimmedResponse)) {
            // Remove non-JSON content from the beginning and end of the string
            trimmedResponse = trimmedResponse.replace(/^[^\{\[]+|[^\}\]]+$/, '');
        }
        try {
            const json = JSON.parse(trimmedResponse);
            return { success: true, json };
        }
        catch (error) {
            this.orchestrator.sendErrorToPanel(`Error creating pipeline: ${this.getErrorMessage(error)}`);
            throw error;
        }
    }
    // private parsePipeline(pipelineString: string,): Pipeline {
    //   const parser = createParser('json');
    //   if (pipelineString.length > 0) {
    //     const parsedPipeline = parser.parse(pipelineString);
    //     console.log(JSON.stringify(parsedPipeline));
    //     return {
    //       name: parsedPipeline.name,
    //       directoryName: parsedPipeline.directoryName,
    //       objectives: parsedPipeline.objectives,
    //       tasks: parsedPipeline.tasks,
    //       state: parsedPipeline.key_concepts
    //     };
    //   } else {
    //     console.log('Failed to parse pipeline');
    //   }
    // }
    async executePipeline(cwd) {
        const results = [];
        let processedToolCalls = [];
        while (this.toolCalls.length > 0) {
            const toolCall = this.toolCalls.shift();
            if (toolCall && !processedToolCalls.find(x => x.id === toolCall.id)) {
                try {
                    const result = await this.executeToolCall(toolCall, cwd);
                    results.push(result);
                    this.orchestrator.sendUpdateToPanel(`Called: ${toolCall.function.name} with arguments ${JSON.stringify(toolCall.function.arguments)}. \n\n The result was ${result}`);
                    // Update state and process pipeline or tool call array results
                    this.updateState(toolCall.function.name, result);
                    if (this.isPipeline(result)) {
                        this.state.set('pipelineName', result.name);
                        this.state.set('directoryName', result.directoryName);
                        this.addToolCalls(result.tasks);
                    }
                    else if (Array.isArray(result) && result.every(item => this.isToolCall(item))) {
                        this.addToolCalls(result);
                    }
                }
                catch (error) {
                    this.orchestrator.sendUpdateToPanel(`Error executing tool call "${toolCall.function.name}": \n\n ${error}`);
                }
                finally {
                    processedToolCalls.push(toolCall);
                }
            }
        }
        return results;
    }
    isToolCall(obj) {
        return obj && typeof obj === 'object' && obj.function && typeof obj.function.name === 'string';
    }
    isPipeline(obj) {
        return obj && typeof obj === 'object' && typeof obj.name === 'string' && typeof obj.directoryName === 'string' && Array.isArray(obj.tasks);
    }
    async executeToolCall(toolCall, cwd) {
        const args = toolCall.function.arguments ? this.updateArgumentsFromState(JSON.stringify(toolCall.function.arguments)) : "";
        return await (0, executables_1.executeTool)(toolCall.function.name, JSON.parse(args), cwd, this.state, this.orchestrator, this);
    }
    updateArgumentsFromState(args) {
        let replacedArgs = args;
        try {
            for (const entry of this.state) {
                // Check if the key exists in the arguments and is of type string before replacing
                if (entry && typeof entry[1] === 'string' && args.includes(`{${entry[0]}}`)) {
                    replacedArgs = replacedArgs.replace(`{${entry[0]}}`, JSON.stringify(entry[1]));
                }
                else {
                    console.error(`Invalid or non-string state variable found for key "${entry[0]}"`);
                }
            }
        }
        catch (error) {
            console.error("Error occurred while replacing state variables:", error);
            throw error; // Re-throw the error after logging to preserve the original error stack trace
        }
        return replacedArgs;
    }
    updateState(toolName, result) {
        this.state.set(toolName, result);
    }
    clearPipeline() {
        this.toolCalls = [];
        this.state.clear();
    }
    getErrorMessage(error) {
        if (error instanceof Error)
            return error.message;
        return String(error);
    }
}
exports.PipelineHandler = PipelineHandler;
//# sourceMappingURL=pipelineHandler.js.map