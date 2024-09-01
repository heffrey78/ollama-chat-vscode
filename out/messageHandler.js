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
exports.MessageHandler = void 0;
const vscode = __importStar(require("vscode"));
const ollama_1 = require("ollama");
const pipelineHandler_1 = require("./pipelineHandler");
const tools_1 = require("./config/tools");
const systemMessage_1 = require("./config/systemMessage");
const ollama = new ollama_1.Ollama({ fetch: fetch });
class MessageHandler {
    constructor(panel) {
        this.panel = panel;
        this.messages = [systemMessage_1.systemMessage];
        this.pipelineHandler = new pipelineHandler_1.PipelineHandler();
    }
    async handleMessage(message) {
        switch (message.command) {
            case 'sendMessage':
                await this.handleSendMessage(message.text);
                break;
            case 'setModel':
                await this.handleSetModel(message.model);
                break;
        }
    }
    async handleSendMessage(text) {
        try {
            const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
            const modelName = config.get('modelName');
            this.messages.push({ role: 'user', content: text });
            const response = await ollama.chat({
                model: modelName,
                messages: this.messages,
                tools: tools_1.ollamaTools,
            });
            this.messages.push(response.message);
            this.panel.webview.postMessage({ command: 'receiveMessage', text: response.message.content });
            if (response.message.tool_calls) {
                await this.handleToolCalls(response.message.tool_calls, modelName);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage('Error communicating with Ollama: ' + error);
        }
    }
    static async handleToolMessage(text, useTools) {
        try {
            const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
            const modelName = config.get('modelName');
            const messages = [systemMessage_1.systemMessage, { role: 'user', content: text }];
            const response = await ollama.chat({
                model: modelName,
                messages: messages,
                tools: useTools ? tools_1.ollamaTools : undefined,
            });
            return response.message.content;
        }
        catch (error) {
            vscode.window.showErrorMessage('Error communicating with Ollama: ' + error);
            return '';
        }
    }
    async handleToolCalls(toolCalls, modelName) {
        this.pipelineHandler.clearPipeline();
        for (const toolCall of toolCalls) {
            this.pipelineHandler.addToolCall(toolCall);
        }
        const cwd = this.getWorkingDirectory();
        const results = await this.pipelineHandler.executePipeline(cwd);
        for (let i = 0; i < results.length; i++) {
            const toolCall = toolCalls[i];
            const result = results[i];
            this.messages.push({ role: 'tool', content: JSON.stringify(result), name: toolCall.function.name });
            this.panel.webview.postMessage({ command: 'receiveMessage', text: `Tool ${toolCall.function.name} executed. Result: ${JSON.stringify(result)}` });
        }
        // Get a follow-up response after tool calls
        const followUpResponse = await ollama.chat({
            model: modelName,
            messages: this.messages,
            tools: tools_1.ollamaTools,
        });
        this.messages.push(followUpResponse.message);
        this.panel.webview.postMessage({ command: 'receiveMessage', text: followUpResponse.message.content });
    }
    async handleSetModel(model) {
        await vscode.workspace.getConfiguration('ollama-chat-vscode').update('modelName', model, vscode.ConfigurationTarget.Global);
    }
    getWorkingDirectory() {
        const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
        const configuredDir = config.get('workingDirectory');
        return configuredDir || require('os').homedir();
    }
    async exportChatHistory() {
        const chatHistory = this.messages.map(msg => {
            if (msg.role === 'user') {
                return `User: ${msg.content}`;
            }
            else if (msg.role === 'assistant') {
                return `Ollama: ${msg.content}`;
            }
            else if (msg.role === 'system') {
                return `System: ${msg.content}`;
            }
            else if (msg.role === 'tool') {
                return `Tool (${msg.name}): ${msg.content}`;
            }
            return '';
        }).join('\n\n');
        try {
            const uri = await vscode.window.showSaveDialog({
                filters: {
                    'Markdown': ['md']
                },
                saveLabel: 'Export Chat History'
            });
            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(chatHistory, 'utf8'));
                this.panel.webview.postMessage({ command: 'chatExported' });
            }
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to export chat history: ' + error);
        }
    }
    async clearChatHistory() {
        this.messages = [systemMessage_1.systemMessage];
        this.panel.webview.postMessage({ command: 'chatCleared' });
    }
}
exports.MessageHandler = MessageHandler;
//# sourceMappingURL=messageHandler.js.map