import { Tool } from 'ollama';
import { handleToolCall } from './toolHandlers';

interface ToolCall {
    type?: 'function';
    function: {
        name: string;
        arguments: { [key: string]: any };
    };
}

export class PipelineHandler {
    private toolCalls: ToolCall[];
    private state: Map<string, any>;

    constructor() {
        this.toolCalls = [];
        this.state = new Map();
    }

    addToolCall(toolCall: ToolCall) {
        this.toolCalls.push(toolCall);
    }

    async executePipeline(cwd: string): Promise<any[]> {
        const results = [];
        for (const toolCall of this.toolCalls) {
            const result = await this.executeToolCall(toolCall, cwd);
            results.push(result);
            this.updateState(toolCall.function.name, result);
        }
        return results;
    }

    private async executeToolCall(toolCall: ToolCall, cwd: string): Promise<any> {
        const args = this.replaceStateVariables(JSON.stringify(toolCall.function.arguments));
        return await handleToolCall(toolCall.function.name, JSON.parse(args), cwd, Object.fromEntries(this.state));
    }

    private replaceStateVariables(args: string): string {
        let replacedArgs = args;
        for (const [key, value] of this.state.entries()) {
            replacedArgs = replacedArgs.replace(`{${key}}`, JSON.stringify(value));
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