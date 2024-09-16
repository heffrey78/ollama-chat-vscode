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
class PipelineHandler {
    constructor(messageHandler) {
        this.lastErrorMessage = '';
        this.orchestrator = messageHandler;
        this.pipelines = [];
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
        if (Array.isArray(toolArray) && toolArray.every(item => this.isToolCall(item))) {
            const pipeline = {
                name: 'Toolcalls',
                directoryName: (0, os_1.homedir)(),
                state: new Map(),
                objectives: undefined,
                toolCalls: toolArray
            };
            logger_1.logger.info(`Created new pipeline 'Toolcalls' with ${toolArray.length} tool calls`);
            return pipeline;
        }
        throw new Error('Pipeline was unable to be created');
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
        logger_1.logger.info(`Executing pipeline ${pipeline.name}`);
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
        logger_1.logger.info(`Pipeline ${pipeline.name} execution completed`);
        this.displayPipeline();
        return results;
    }
    async executeAdhocToolCall(toolName, args) {
        const toolCall = this.generateToolCall(toolName, args);
        const pipeline = this.createPipeline([toolCall]);
        return await this.executeToolCall(pipeline, toolCall);
    }
    // Pipeline Generation
    async generatePipelinePart(pipelinePrompt) {
        const maxRetries = 3;
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                const pipelineJson = JSON.parse(pipelinePrompt);
                if (pipelineJson.attempts) {
                    pipelineJson.attempts = retryCount;
                }
                const pipelinePartMessage = this.createGenerateMessage(JSON.stringify(pipelineJson));
                logger_1.logger.info(`Generating pipeline part, attempt ${retryCount + 1}`);
                const pipelineResponse = await this.orchestrator.handleMessage(pipelinePartMessage);
                const { success, json } = await this.tryParseJson(pipelineResponse.content);
                if (success) {
                    logger_1.logger.info('Successfully generated pipeline part');
                    return json;
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
        const args = toolCall.function.arguments ? this.updateArgumentsFromState(pipeline, JSON.stringify(toolCall.function.arguments)) : "";
        logger_1.logger.info(`Executing tool call: ${toolCall.function.name}`);
        return await (0, executables_1.executeTool)(toolCall.function.name, JSON.parse(args), pipeline.state, this.orchestrator, this);
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
    async tryParseJson(response) {
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
            logger_1.logger.info('Successfully parsed JSON response');
            return { success: true, json };
        }
        catch (error) {
            logger_1.logger.error(`Error parsing JSON: ${this.getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error creating pipeline: ${this.getErrorMessage(error)}`);
            return { success: false };
        }
    }
    balanceBracketsAndBraces(str) {
        const stack = [];
        const open = { '{': '}', '[': ']' };
        const close = { '}': '{', ']': '[' };
        let balanced = str;
        for (const char of str) {
            if (char in open) {
                stack.push(char);
            }
            else if (char in close) {
                if (stack.length === 0 || stack[stack.length - 1] !== close[char]) {
                    stack.push(close[char]);
                    balanced = close[char] + balanced;
                }
                else {
                    stack.pop();
                }
            }
        }
        while (stack.length > 0) {
            const char = stack.pop();
            balanced += open[char];
        }
        return balanced;
    }
    fixEncodingIssues(str) {
        return str
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/\u2026/g, '...')
            .replace(/\u2013/g, '-')
            .replace(/\u2014/g, '--')
            .replace(/\u00A0/g, ' ');
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