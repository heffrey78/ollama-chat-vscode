import * as vscode from 'vscode';
import { Message, ChatRequest } from 'ollama';
import { PipelineHandler } from './pipelineHandler';
import { ollamaTools } from './config/tools';
import { systemMessage } from './config/systemMessage';
import { LlmClient, createLlmClient } from './llmClients';

// Extend the Message type to include the 'name' property for tool messages
type ExtendedMessage = Message & { name?: string };

export class Orchestrator {
    private config: vscode.WorkspaceConfiguration;
    private messages: ExtendedMessage[];
    private pipelineHandler: PipelineHandler;
    private panel: vscode.WebviewPanel;
    private projectDirectory: string;
    private llmClient!: LlmClient;

    constructor(panel: vscode.WebviewPanel, config: vscode.WorkspaceConfiguration, projectDirectory: string) {
        this.panel = panel;
        this.config = config;
        this.messages = [systemMessage as ExtendedMessage];
        this.pipelineHandler = new PipelineHandler(this);
        this.projectDirectory = projectDirectory;
    }

public async handleMessage(message: any): Promise<Message> {
        switch (message.command) {
            case 'sendMessage':
                let chatResponse = await this.executeLlmChatRequest(message.text);
                if(this.pipelineHandler.getToolCalls().length > 0) {
                    return this.executePipeline();
                }
                return message;
                break;
            case 'setModel':
                await this.setModel(message.model);
                return { role: 'assistant', content: 'model set'};
                break;
            case 'setProvider':
                await this.setModelProvider(message.provider);
                return { role: 'assistant', content: 'provider set'};
                break;
            case 'refreshProviders':
                const providersResponse = this.getProviderList();
                const providerList = JSON.stringify(providersResponse);
                return { role: 'assistant', content: providerList };
                break;
            case 'refreshModels':
                const provider = await this.getModelProvider();
                const modelResponse = await this.getModelsByProvider(provider);
                const modelList =  JSON.stringify(modelResponse);
                return { role: 'assistant', content: modelList };
                break;
            case 'executePipeline':
                return await this.executePipeline();
                break;
        }
        return { role: 'assistant', content: 'No message handler found.'};
    }

    private async executeLlmChatRequest(text: string): Promise<Message> {
        try {
            const modelName = this.llmClient.model;
            this.messages.push({ role: 'user', content: text });
            const response = await this.llmClient.chat({
                model: modelName,
                messages: this.messages,
                stream: false,
                options: {
                    tools: ollamaTools
                }
            } as ChatRequest);
            this.messages.push(response.message as ExtendedMessage);

            if (response.message.tool_calls) {
                this.addToolCallsToPipeline(response.message.tool_calls);
            } 
            return response.message
        } catch (error) {
            this.sendErrorToPanel('Error communicating with LLM: ' + error);
        }
        return { role: 'assistant', content: 'An unexpected error occurred' };
    }

    public async executePipeline(): Promise<Message> {
        const results = await this.pipelineHandler.executePipeline(this.projectDirectory);
        const toolCalls = this.pipelineHandler.getToolCalls();
        let content = "";

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const toolCall = toolCalls[i];
            let toolMessage = { role: 'tool', content: JSON.stringify(result), name: toolCall.function.name };
            this.messages.push(toolMessage);
            content += toolMessage.content;
        }

        return  { role: 'assistant', content: content};
    }

    private async setModel(model: string) {
        await this.llmClient.setModel(model);
    }

    private async setModelProvider(provider: string) {
        await this.config.update('provider', provider, vscode.ConfigurationTarget.Global);
        if(!this.llmClient || !this.llmClient.provider || this.llmClient.provider != provider) {
            await this.initializeLlmClient(provider);
        }
        else this.llmClient.provider = provider;
    }

    public async getModelProvider(): Promise<string> {
        if(!this.llmClient) {
            await this.initializeLlmClient();
        }
        return  this.llmClient.provider;
    }

    public sendUpdateToPanel(message: any) {
        this.messages.push({ role: 'tool', content: message });
        this.panel.webview.postMessage({ command: 'receiveMessage', text: message });
    }

    public sendErrorToPanel(errorMessage: string) {
        this.panel.webview.postMessage({ command: 'receiveMessage', text: errorMessage });
    }

    private async initializeLlmClient(provider: string = "ollama"): Promise<void> {
        try {
            this.llmClient = await createLlmClient(provider);
            await this.getModelsByProvider(this.llmClient.provider);
        } catch (error) {
            if (error instanceof Error && error.message.includes('API key is not set')) {
                // TODO throw and let extension.ts handle it
                await this.handleApiKeyRequest(provider);
            } else {
                throw error;
            }
        }
    }

    // TODO Move to extension
    private async handleApiKeyRequest(provider: string): Promise<void> {
        const apiKey = await vscode.window.showInputBox({
            prompt: `Please enter your ${provider} API key`,
            password: true
        });
        if (apiKey) {
            await this.config.update(`${provider}ApiKey`, apiKey, vscode.ConfigurationTarget.Global);
            this.llmClient = await createLlmClient(provider);
        } else {
            throw new Error(`${provider} API key is required`);
        }
    }

    private getProviderList(): string[] {
        const providers = ['ollama', 'claude', 'openai'];
        return providers;
    }

    public async getModelsByProvider(provider: string): Promise<string[]> {
        if(!this.llmClient || this.llmClient.provider != provider) {
            this.llmClient = await createLlmClient(provider);
        }

        const models = await this.llmClient.getModels();
        return models;
    }

    private async addToolCallsToPipeline(toolCalls: any[]) {
        this.pipelineHandler.addToolCalls(toolCalls);
    }

    public async exportChatHistory() {
        const chatHistory = this.messages.map(msg => {
            if (msg.role === 'user') {
                return `User: ${msg.content}`;
            } else if (msg.role === 'assistant') {
                return `LLM: ${msg.content}`;
            } else if (msg.role === 'system') {
                return `System: ${msg.content}`;
            } else if (msg.role === 'tool') {
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
            }
        } catch (error) {
            this.sendErrorToPanel('Failed to export chat history: ' + error);
        }
    }

    public async clearChatHistory() {
        this.messages = [systemMessage as ExtendedMessage];
    }
}