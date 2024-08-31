"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineHandler = void 0;
const toolHandlers_1 = require("./toolHandlers");
class PipelineHandler {
    constructor() {
        this.toolCalls = [];
        this.state = new Map();
    }
    addToolCall(toolCall) {
        this.toolCalls.push(toolCall);
    }
    async executePipeline(cwd) {
        const results = [];
        for (const toolCall of this.toolCalls) {
            const result = await this.executeToolCall(toolCall, cwd);
            results.push(result);
            this.updateState(toolCall.function.name, result);
        }
        return results;
    }
    async executeToolCall(toolCall, cwd) {
        const args = this.replaceStateVariables(JSON.stringify(toolCall.function.arguments));
        return await (0, toolHandlers_1.handleToolCall)(toolCall.function.name, JSON.parse(args), cwd, Object.fromEntries(this.state));
    }
    replaceStateVariables(args) {
        let replacedArgs = args;
        for (const [key, value] of this.state.entries()) {
            replacedArgs = replacedArgs.replace(`{${key}}`, JSON.stringify(value));
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