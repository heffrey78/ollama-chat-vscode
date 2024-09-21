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
const messageType_1 = require("./messages/messageType");
const messageTools_1 = require("./messages/messageTools");
class PipelineHandler {
    constructor(messageHandler) {
        this.lastErrorMessage = '';
        this.orchestrator = messageHandler;
        this.pipelines = [];
        this.messageTools = new messageTools_1.MessageTools();
        logger_1.logger.info('PipelineHandler initialized');
    }
    // Pipeline Management
    addPipeline(pipeline) {
        this.pipelines.push(pipeline);
        this.displayPipeline();
        logger_1.logger.info(`Added pipeline: ${pipeline.name}`);
    }
    getPipeline(name) {
        const pipeline = this.pipelines.find(x => x.name === name);
        if (!pipeline) {
            logger_1.logger.error(`Pipeline ${name} does not exist`);
            throw new Error(`Pipeline ${name} does not exist.`);
        }
        logger_1.logger.info(`Retrieved pipeline ${name}`);
        return pipeline;
    }
    createPipeline(toolArray) {
        if (!Array.isArray(toolArray)) {
            throw new Error('Input must be an array of ToolCalls');
        }
        if (!toolArray.every(item => this.isToolCall(item))) {
            throw new Error('All items in the array must be valid ToolCalls');
        }
        const pipeline = {
            name: `Toolcalls-${new Date().toISOString()}`,
            directoryName: (0, os_1.homedir)(),
            state: new Map(),
            objectives: [],
            toolCalls: toolArray,
        };
        logger_1.logger.info(`Created new pipeline '${pipeline.name}' with ${toolArray.length} tool calls`);
        return pipeline;
    }
    createAndAddPipeline(toolArray) {
        const pipeline = this.createPipeline(toolArray);
        this.addPipeline(pipeline);
        return pipeline;
    }
    clearPipelines() {
        this.pipelines = [];
        logger_1.logger.info('Cleared all pipelines');
    }
    getPipelinesLength() {
        return this.pipelines.length;
    }
    getToolCallsLength() {
        let toolCallsLength = 0;
        this.pipelines.map(x => x.toolCalls.length).forEach(x => toolCallsLength += x);
        return toolCallsLength;
    }
    // Tool Call Management
    addToolCalls(pipeline, newToolCalls) {
        const toolCallsToAdd = Array.isArray(newToolCalls) ? newToolCalls : [newToolCalls];
        for (const toolCall of toolCallsToAdd) {
            toolCall.id = toolCall.id || uuid.v4();
        }
        pipeline.toolCalls.unshift(...toolCallsToAdd);
        logger_1.logger.info(`Added ${toolCallsToAdd.length} tool calls to pipeline ${pipeline.name}`);
    }
    getToolCalls(pipeline) {
        logger_1.logger.info(`Getting tool calls for pipeline ${pipeline.name}`);
        return pipeline.toolCalls;
    }
    // Pipeline Execution
    async executePipeline(pipeline) {
        const results = [];
        const processedToolCalls = [];
        try {
            logger_1.logger.info(`Executing pipeline ${pipeline.name}`);
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
                        }
                        catch (error) {
                            this.handleExecutionError(task, error);
                        }
                        finally {
                            processedToolCalls.push(task);
                        }
                    }
                }
            }
        }
        catch (error) {
            this.handlePipelineError(pipeline, error);
        }
        this.removePipeline(pipeline);
        logger_1.logger.info(`Pipeline ${pipeline.name} execution completed`);
        this.displayPipeline();
        return results;
    }
    async executeAdhocToolCall(toolName, args) {
        const toolCall = this.generateToolCall(toolName, args);
        const pipeline = this.createPipeline([toolCall]);
        const result = await this.executeToolCall(pipeline, toolCall);
        this.removePipeline(pipeline);
        return result;
    }
    // Pipeline Generation
    async generatePipelinePart(pipelinePrompt) {
        const maxRetries = 3;
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                const pipelineJsonParse = await this.messageTools.multiAttemptJsonParse(pipelinePrompt); // await this.messageTools.tryParseJson(pipelinePrompt);
                if (pipelineJsonParse && pipelineJsonParse.attempts) {
                    pipelineJsonParse.attempts = retryCount;
                }
                // Always calling generate instead of chat...SHOULD we make a decision since we have a fallback to generate now?
                const pipelinePartMessage = this.createGenerateMessage(JSON.stringify(pipelineJsonParse));
                logger_1.logger.info(`Generating pipeline part, attempt ${retryCount + 1}`);
                const pipelineResponse = await this.orchestrator.handleMessage(pipelinePartMessage);
                const pipelinePartJson = await this.messageTools.multiAttemptJsonParse(pipelineResponse.content); // await this.messageTools.tryParseJson(pipelineResponse.content);
                if (pipelinePartJson) {
                    logger_1.logger.info('Successfully generated pipeline part');
                    return { message: { role: 'system', content: JSON.stringify(pipelinePartJson) } };
                }
            }
            catch (error) {
                this.handleGenerationError(error, retryCount, maxRetries);
            }
            retryCount++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        logger_1.logger.error('Failed to parse plan');
        throw new Error('Failed to parse plan');
    }
    // Utility Methods
    isToolCall(obj) {
        return obj && typeof obj === 'object' && obj.function && typeof obj.function.name === 'string';
    }
    isPipeline(obj) {
        return obj && typeof obj === 'object' && typeof obj.name === 'string' && typeof obj.directoryName === 'string' && Array.isArray(obj.toolCalls);
    }
    removePipeline(pipeline) {
        this.pipelines = Array.from(this.pipelines).filter(item => item !== pipeline);
    }
    generateToolCall(toolName, args) {
        return {
            id: uuid.v4(),
            type: 'function',
            function: {
                name: toolName,
                arguments: args
            }
        };
    }
    async executeToolCall(pipeline, toolCall) {
        try {
            const args = toolCall.function.arguments ? this.updateArgumentsFromState(pipeline, JSON.stringify(toolCall.function.arguments)) : "";
            logger_1.logger.info(`Executing tool call: ${toolCall.function.name}`);
            return await (0, executables_1.executeTool)(toolCall.function.name, JSON.parse(args), pipeline.state, this.orchestrator, this);
        }
        catch (error) {
            logger_1.logger.error(`Error occurred while executing tool call: ${this.getErrorMessage(error)}`);
            throw error;
        }
    }
    updateArgumentsFromState(pipeline, args) {
        let replacedArgs = args;
        try {
            for (const [key, value] of pipeline.state.entries()) {
                if (typeof value === 'string' && args.includes(`{${key}}`)) {
                    replacedArgs = replacedArgs.replace(`{${key}}`, JSON.stringify(value));
                }
                else {
                    logger_1.logger.warn(`Invalid or non-string state variable found for key "${key}"`);
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
    handleExecutionResult(result) {
        if (this.isPipeline(result)) {
            const newPipeline = result;
            newPipeline.state.set('pipelineName', result.name);
            newPipeline.state.set('directoryName', result.directoryName);
            this.addToolCalls(newPipeline, result.toolCalls);
            logger_1.logger.info(`Created new pipeline from result: ${newPipeline.name}`);
        }
        else if (Array.isArray(result) && result.every(item => this.isToolCall(item))) {
            const adhocPipeline = this.createPipeline(result);
            this.addPipeline(adhocPipeline);
            logger_1.logger.info(`Created new ad-hoc pipeline with ${result.length} tool calls`);
        }
    }
    handlePipelineError(pipeline, error) {
        logger_1.logger.error(`Error executing tool call "${pipeline.name}": ${this.getErrorMessage(error)}`);
        this.orchestrator.sendUpdateToPanel(`Error executing tool call "${pipeline.name}": \n\n ${error}`);
    }
    handleExecutionError(task, error) {
        logger_1.logger.error(`Error executing tool call "${task.function.name}": ${this.getErrorMessage(error)}`);
        this.orchestrator.sendUpdateToPanel(`Error executing tool call "${task.function.name}": \n\n ${error}`);
    }
    handleGenerationError(error, retryCount, maxRetries) {
        if (error instanceof SyntaxError) {
            this.lastErrorMessage = error.message;
            logger_1.logger.error(`JSON parse error: ${this.lastErrorMessage}`);
        }
        else {
            logger_1.logger.error(`Unexpected error: ${this.getErrorMessage(error)}`);
            throw error;
        }
        if (retryCount === maxRetries - 1) {
            logger_1.logger.error(`Failed to receive valid JSON after ${maxRetries} retries`);
            throw new Error(`Failed to receive valid JSON after ${maxRetries} retries.`);
        }
    }
    createGenerateMessage(pipelinePrompt) {
        return {
            role: 'system',
            command: messageType_1.MessageType.Generate,
            content: pipelinePrompt,
            tool_use: false
        };
    }
    getErrorMessage(error) {
        return error instanceof Error ? error.message : String(error);
    }
    displayPipeline() {
        if (this.pipelines.length === 0) {
            this.orchestrator.sendUpdateToPanel("No pipelines to display.");
            return;
        }
        const headers = ["Pipeline Name", "Directory Name", "Tool Name", "Tool Arguments"];
        const rows = this.pipelines.flatMap(pipeline => pipeline.toolCalls.map(toolCall => [
            pipeline.name,
            pipeline.directoryName,
            toolCall.function.name,
            JSON.stringify(toolCall.function.arguments)
        ]));
        const maxWidths = headers.map((header, index) => Math.max(header.length, ...rows.map(row => String(row[index]).length)));
        const headerRow = headers.map((header, index) => header.padEnd(maxWidths[index])).join(" | ");
        const separatorRow = maxWidths.map(width => "-".repeat(width)).join("-+-");
        const output = [`| ${headerRow} |`, `| ${separatorRow} |`];
        rows.map(row => output.push(`| ${row.map((cell, index) => String(cell).padEnd(maxWidths[index])).join(" | ")} |`));
        output.forEach(line => this.orchestrator.sendUpdateToPanel(line));
    }
}
exports.PipelineHandler = PipelineHandler;
//# sourceMappingURL=pipelineHandler.js.map