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
const os_1 = require("os");
const uuid = __importStar(require("uuid"));
const executables_1 = require("./tools/executables");
const logger_1 = require("./logger");
class PipelineHandler {
    constructor(messageHandler) {
        this.orchestrator = messageHandler;
        this.pipelines = [];
        logger_1.logger.info('PipelineHandler initialized');
    }
    addToolCalls(pipeline, newToolCalls) {
        const toolCallsToAdd = Array.isArray(newToolCalls) ? newToolCalls : [newToolCalls];
        for (const toolCall of toolCallsToAdd) {
            toolCall.id = toolCall.id || uuid.v4();
        }
        pipeline.tasks.unshift(...toolCallsToAdd);
        logger_1.logger.info(`Added ${toolCallsToAdd.length} tool calls to pipeline ${pipeline.name}`);
    }
    getToolCalls(pipeLine) {
        logger_1.logger.info(`Getting tool calls for pipeline ${pipeLine.name}`);
        return pipeLine.tasks;
    }
    getPipeline(name) {
        const pipeline = this.pipelines.find(x => x.name == name);
        if (!pipeline || pipeline == undefined) {
            logger_1.logger.error(`Pipeline ${name} does not exist`);
            throw new Error(`Pipeline ${name} does not exist.`);
        }
        logger_1.logger.info(`Retrieved pipeline ${name}`);
        return pipeline;
    }
    createPipeline(toolArray) {
        if (Array.isArray(toolArray) && toolArray.every(item => this.isToolCall(item))) {
            const pipeline = {
                name: 'Toolcalls',
                directoryName: os_1.homedir.toString(),
                state: new Map(),
                objectives: undefined,
                tasks: toolArray
            };
            logger_1.logger.info(`Created new pipeline 'Toolcalls' with ${toolArray.length} tool calls`);
            return pipeline;
        }
        throw new Error('Pipeline was unable to be created');
    }
    createAndAddPipeline(toolArray) {
        const pipeline = this.createPipeline(toolArray);
        this.pipelines.push(pipeline);
    }
    async generatePipelinePart(pipelinePrompt) {
        const maxRetries = 3;
        let retryCount = 0;
        let pipelineJson = {};
        let errorMessage = "";
        while (retryCount < maxRetries) {
            try {
                const failureReply = retryCount > 0 ? `Attempt #${retryCount + 1}. Error from JSON.parse when trying to parse previous response: ${errorMessage}` : "";
                const pipelineMessage = { role: 'system', command: 'sendMessage', content: pipelinePrompt + failureReply, tool_use: false };
                logger_1.logger.info(`Generating pipeline part, attempt ${retryCount + 1}`);
                const pipelineResponse = await this.orchestrator.handleMessage(pipelineMessage);
                const trimmedResponse = await this.tryParseJson(pipelineResponse.content);
                pipelineJson = trimmedResponse.json;
                logger_1.logger.info('Successfully generated pipeline part');
                break;
            }
            catch (error) {
                if (error instanceof SyntaxError) {
                    errorMessage = error.message;
                    logger_1.logger.error(`JSON parse error: ${errorMessage}`);
                }
                if (!(error instanceof SyntaxError)) {
                    logger_1.logger.error(`Unexpected error: ${this.getErrorMessage(error)}`);
                    throw error;
                }
                retryCount++;
                if (retryCount === maxRetries) {
                    logger_1.logger.error(`Failed to receive valid JSON after ${maxRetries} retries`);
                    throw new Error(`Failed to receive valid JSON after ${maxRetries} retries.`);
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
        if (pipelineJson) {
            return pipelineJson;
        }
        else {
            logger_1.logger.error('Failed to parse plan');
            throw new Error('Failed to parse plan');
        }
    }
    async tryParseJson(response) {
        let trimmedResponse = response.trim();
        const jsonRegex = /(\{[\s\S]*?\}|\[[\s\S]*?\])/g;
        const matches = trimmedResponse.match(jsonRegex);
        if (matches) {
            // Find the longest JSON string
            trimmedResponse = matches.reduce((a, b) => a.length > b.length ? a : b);
        }
        else {
            trimmedResponse = trimmedResponse.replace(/^[^\{\[]+|[^\}\]]+$/, '');
        }
        try {
            const json = JSON.parse(trimmedResponse);
            logger_1.logger.info('Successfully parsed JSON response');
            return { success: true, json };
        }
        catch (error) {
            logger_1.logger.error(`Error parsing JSON: ${this.getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error creating pipeline: ${this.getErrorMessage(error)}`);
            // Call LLM for parsing improvement suggestions
            try {
                const errorMessage = this.getErrorMessage(error);
                const stackTrace = error instanceof Error ? error.stack : 'No stack trace available';
                const messageContent = `I encountered an error while parsing JSON: "${errorMessage}". Here's the stack trace: ${stackTrace}. Can you suggest improvements to the parsing method or identify potential issues with the JSON string?`;
                const chatToolCall = {
                    id: uuid.v4(),
                    type: "function",
                    function: {
                        name: 'chat',
                        arguments: { message: messageContent }
                    }
                };
                this.createAndAddPipeline([chatToolCall]);
                if (this.pipelines.length == 1) {
                    await this.executePipelines();
                }
            }
            catch (llmError) {
                logger_1.logger.error(`Error getting LLM suggestion: ${this.getErrorMessage(llmError)}`);
            }
            return { success: false };
        }
    }
    async executePipeline(pipeline) {
        const results = [];
        const processedToolCalls = [];
        logger_1.logger.info(`Executing pipeline ${pipeline.name}`);
        if (pipeline != undefined) {
            while (pipeline.tasks.length > 0) {
                const task = pipeline.tasks.shift();
                if (task && !pipeline.tasks.find(x => x.id === task.id)) {
                    try {
                        logger_1.logger.info(`Executing tool call: ${task.function.name}`);
                        const result = await this.executeToolCall(pipeline, task);
                        results.push(result);
                        this.orchestrator.sendUpdateToPanel(`Called: ${task.function.name} with arguments ${JSON.stringify(task.function.arguments)}. \n\n The result was ${result}`);
                        this.updateState(pipeline, task.function.name, result);
                        if (this.isPipeline(result)) {
                            const newPipeline = result;
                            newPipeline.state.set('pipelineName', result.name);
                            newPipeline.state.set('directoryName', result.directoryName);
                            this.addToolCalls(newPipeline, result.tasks);
                            logger_1.logger.info(`Created new pipeline from result: ${newPipeline.name}`);
                        }
                        else if (Array.isArray(result) && result.every(item => this.isToolCall(item))) {
                            const adhocPipeline = {
                                name: 'Toolcalls',
                                directoryName: os_1.homedir.toString(),
                                state: new Map(),
                                objectives: undefined,
                                tasks: result
                            };
                            this.pipelines.push(adhocPipeline);
                            logger_1.logger.info(`Created new ad-hoc pipeline with ${result.length} tool calls`);
                        }
                    }
                    catch (error) {
                        logger_1.logger.error(`Error executing tool call "${task.function.name}": ${this.getErrorMessage(error)}`);
                        this.orchestrator.sendUpdateToPanel(`Error executing tool call "${task.function.name}": \n\n ${error}`);
                    }
                    finally {
                        processedToolCalls.push(task);
                    }
                }
            }
        }
        logger_1.logger.info(`Pipeline ${pipeline.name} execution completed`);
        return results;
    }
    async executePipelines() {
        logger_1.logger.info('Executing all pipelines');
        while (this.pipelines.length > 0) {
            const pipeline = this.pipelines.shift();
            if (pipeline) {
                await this.executePipeline(pipeline);
            }
        }
        logger_1.logger.info('All pipelines executed');
    }
    isToolCall(obj) {
        return obj && typeof obj === 'object' && obj.function && typeof obj.function.name === 'string';
    }
    isPipeline(obj) {
        return obj && typeof obj === 'object' && typeof obj.name === 'string' && typeof obj.directoryName === 'string' && Array.isArray(obj.tasks);
    }
    generateToolCall(toolName, args) {
        const toolCall = {
            id: uuid.v4.toString(),
            type: 'function',
            function: {
                name: toolName,
                arguments: args
            }
        };
        return toolCall;
    }
    async executeAdhocToolCall(toolName, args) {
        const toolCall = this.generateToolCall(toolName, args);
        const pipeline = this.createPipeline([toolCall]);
        const result = await this.executeToolCall(pipeline, toolCall);
        return result;
    }
    async executeToolCall(pipeLine, toolCall) {
        const args = toolCall.function.arguments ? this.updateArgumentsFromState(pipeLine, JSON.stringify(toolCall.function.arguments)) : "";
        logger_1.logger.info(`Executing tool call: ${toolCall.function.name}`);
        return await (0, executables_1.executeTool)(toolCall.function.name, JSON.parse(args), pipeLine.state, this.orchestrator, this);
    }
    updateArgumentsFromState(pipeline, args) {
        let replacedArgs = args;
        try {
            for (const entry of pipeline.state) {
                if (entry && typeof entry[1] === 'string' && args.includes(`{${entry[0]}}`)) {
                    replacedArgs = replacedArgs.replace(`{${entry[0]}}`, JSON.stringify(entry[1]));
                }
                else {
                    logger_1.logger.warn(`Invalid or non-string state variable found for key "${entry[0]}"`);
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`Error occurred while replacing state variables: ${this.getErrorMessage(error)}`);
            throw error;
        }
        return replacedArgs;
    }
    updateState(pipeline, toolName, result) {
        pipeline.state.set(toolName, result);
        logger_1.logger.info(`Updated state for pipeline ${pipeline.name}, tool: ${toolName}`);
    }
    clearPipelines() {
        this.pipelines = [];
        logger_1.logger.info('Cleared all pipelines');
    }
    getErrorMessage(error) {
        if (error instanceof Error)
            return error.message;
        return String(error);
    }
}
exports.PipelineHandler = PipelineHandler;
//# sourceMappingURL=pipelineHandler.js.map