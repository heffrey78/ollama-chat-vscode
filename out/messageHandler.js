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
const pipelineHandler_1 = require("./pipelineHandler");
const tools_1 = require("./config/tools");
const systemMessage_1 = require("./config/systemMessage");
const llmClients_1 = require("./llmClients");
class MessageHandler {
    constructor(panel, projectDirectory) {
        this.panel = panel;
        this.messages = [systemMessage_1.systemMessage];
        this.pipelineHandler = new pipelineHandler_1.PipelineHandler(this);
        this.projectDirectory = projectDirectory;
    }
    async handleMessage(message) {
        switch (message.command) {
            case 'sendMessage':
                await this.executeLlmChatRequest(message.text);
                break;
            case 'sendToolMessage':
                await this.executeLlmToolRequest(message.text, true);
                break;
            case 'setModel':
                await this.setModel(message.model);
                break;
            case 'setProvider':
                await this.setModelProvider(message.provider);
                break;
            case 'refreshProviders':
                this.updateProviderList();
                break;
            case 'refreshModels':
                await this.updateModelList();
                break;
        }
    }
    async executeLlmChatRequest(text) {
        try {
            const modelName = this.llmClient.model;
            this.messages.push({ role: 'user', content: text });
            const response = await this.llmClient.chat({
                model: modelName,
                messages: this.messages,
                stream: false,
                options: {
                    tools: tools_1.ollamaTools
                }
            });
            this.messages.push(response.message);
            if (response.message.tool_calls) {
                this.panel.webview.postMessage({ command: 'receiveMessage', text: `Tool calls: ${JSON.stringify(response.message)}` });
                await this.addToolCallsExecutePipeline(response.message.tool_calls, modelName);
            }
            else if (response.message.content) {
                this.panel.webview.postMessage({ command: 'receiveMessage', text: response.message.content });
            }
        }
        catch (error) {
            this.handleErrorMessage('Error communicating with LLM: ' + error);
        }
    }
    async executeLlmToolRequest(text, useTools) {
        try {
            const modelName = this.llmClient.model;
            const messages = [systemMessage_1.systemMessage, { role: 'user', content: text }];
            const response = await this.llmClient.chat({
                model: modelName,
                messages: messages,
                stream: false,
                options: {
                    tools: useTools ? tools_1.ollamaTools : undefined
                }
            });
            return response.message.content || '';
        }
        catch (error) {
            return `Error communicating with LLM: ${error}`;
        }
    }
    async setModel(model) {
        await this.llmClient.setModel(model);
    }
    async setModelProvider(provider) {
        await vscode.workspace.getConfiguration('ollama-chat-vscode').update('provider', provider, vscode.ConfigurationTarget.Global);
        if (!this.llmClient || !this.llmClient.provider || this.llmClient.provider != provider) {
            await this.initializeLlmClient(provider);
        }
    }
    sendUpdateToPanel(message) {
        this.messages.push({ role: 'tool', content: message });
        this.panel.webview.postMessage({ command: 'receiveMessage', text: message });
    }
    async initializeLlmClient(provider = "ollama") {
        try {
            this.llmClient = await (0, llmClients_1.createLlmClient)(provider);
            this.updateProviderList();
            await this.updateModelList();
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('API key is not set')) {
                await this.handleApiKeyRequest(provider);
            }
            else {
                throw error;
            }
        }
    }
    async handleApiKeyRequest(provider) {
        const apiKey = await vscode.window.showInputBox({
            prompt: `Please enter your ${provider} API key`,
            password: true
        });
        if (apiKey) {
            await vscode.workspace.getConfiguration('ollama-chat-vscode').update(`${provider}ApiKey`, apiKey, vscode.ConfigurationTarget.Global);
            this.llmClient = await (0, llmClients_1.createLlmClient)(provider);
        }
        else {
            throw new Error(`${provider} API key is required`);
        }
    }
    updateProviderList() {
        const providers = ['ollama', 'claude', 'openai'];
        this.panel.webview.postMessage({ command: 'updateProviders', providers });
    }
    async updateModelList() {
        const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
        const provider = config.get('provider');
        if (!this.llmClient || this.llmClient.provider != provider) {
            this.llmClient = await (0, llmClients_1.createLlmClient)(provider);
        }
        const updatedModels = await this.llmClient.getModels();
        this.panel.webview.postMessage({ command: 'updateModels', models: updatedModels });
    }
    async addToolCallsExecutePipeline(toolCalls, modelName) {
        this.pipelineHandler.addToolCalls(toolCalls);
        const results = await this.pipelineHandler.executePipeline(this.projectDirectory);
        for (let i = 0; i < results.length; i++) {
            const toolCall = toolCalls[i];
            const result = results[i];
            this.messages.push({ role: 'tool', content: JSON.stringify(result), name: toolCall.function.name });
            this.panel.webview.postMessage({ command: 'receiveMessage', text: `Tool ${toolCall.function.name} executed. Result: ${JSON.stringify(result)}` });
        }
        // Get a follow-up response after tool calls
        const followUpResponse = await this.llmClient.chat({
            model: modelName,
            messages: this.messages,
            stream: false,
            options: {
                tools: tools_1.ollamaTools
            }
        });
        this.messages.push(followUpResponse.message);
        this.panel.webview.postMessage({ command: 'receiveMessage', text: followUpResponse.message.content });
    }
    async exportChatHistory() {
        const chatHistory = this.messages.map(msg => {
            if (msg.role === 'user') {
                return `User: ${msg.content}`;
            }
            else if (msg.role === 'assistant') {
                return `LLM: ${msg.content}`;
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
            this.handleErrorMessage('Failed to export chat history: ' + error);
        }
    }
    async clearChatHistory() {
        this.messages = [systemMessage_1.systemMessage];
        this.panel.webview.postMessage({ command: 'chatCleared' });
    }
    handleErrorMessage(errorMessage) {
        this.panel.webview.postMessage({ command: 'receiveMessage', text: errorMessage });
    }
}
exports.MessageHandler = MessageHandler;
//# sourceMappingURL=messageHandler.js.map