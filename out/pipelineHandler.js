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
const toolHandlers_1 = require("./toolHandlers");
class PipelineHandler {
    constructor(messageHandler) {
        this.toolCalls = [];
        this.state = new Map();
        this.messageHandler = messageHandler;
    }
    addToolCall(toolCall) {
        toolCall.id = toolCall.id || uuid.v4();
        this.toolCalls.push(toolCall);
    }
    async executePipeline(cwd) {
        const results = [];
        let processedToolCalls = [];
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
                    }
                    else if (Array.isArray(result) && result.every(item => this.isToolCall(item))) {
                        for (const newToolCall of result) {
                            this.addToolCall(newToolCall);
                        }
                    }
                }
                catch (error) {
                    this.messageHandler.updateUser(`Error executing tool call "${toolCall.function.name}": \n\n ${error}`);
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
        return await (0, toolHandlers_1.handleToolCall)(toolCall.function.name, JSON.parse(args), cwd, this.state, this.messageHandler);
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
}
exports.PipelineHandler = PipelineHandler;
//# sourceMappingURL=pipelineHandler.js.map