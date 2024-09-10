import * as vscode from 'vscode';
import { PipelineHandler } from './pipelineHandler';
import { ollamaTools } from './config/tools';
import { systemMessage } from './config/systemMessage';
import { createLlmClient } from './llmClients';
import { Message } from './messages/Message';
import { GenerateResponse } from './chats/generateResponse';
import { GenerateRequest } from './chats/generateRequest';
import { ChatRequest } from './chats/chatRequest';
import { LlmClient } from './llmClients/llmClient';
import { logger } from './logger';

// Extend the Message type to include the 'name' property for tool messages
type ToolMessage = Message & { name?: string };

export class Orchestrator {
    private config: vscode.WorkspaceConfiguration;
    private messages: ToolMessage[];
    private pipelineHandler: PipelineHandler;
    private panel: vscode.WebviewPanel;
    private projectDirectory: string;
    private llmClient!: LlmClient;

    constructor(panel: vscode.WebviewPanel, config: vscode.WorkspaceConfiguration, projectDirectory: string) {
        this.panel = panel;
        this.config = config;
        this.messages = [systemMessage as ToolMessage];
        this.pipelineHandler = new PipelineHandler(this);
        this.projectDirectory = projectDirectory;
        logger.info('Orchestrator initialized');
    }

    public async handleMessage(message: any): Promise<Message> {
        logger.info(`Handling message: ${message.command}`);
        switch (message.command) {
            case 'sendMessage':
                let response = await this.executeLlmChatRequest(message.text, message.tool_use);
                return response;
            case 'generate':
                let generationResponse = await this.executeLlmChatRequest(message.text, message.tool_use);
                return generationResponse;
            case 'setModel':
                await this.setModel(message.model);
                return { role: 'assistant', content: 'model set' };
            case 'setProvider':
                await this.setModelProvider(message.provider);
                return { role: 'assistant', content: 'provider set' };
            case 'refreshProviders':
                const providersResponse = this.getProviderList();
                const providerList = JSON.stringify(providersResponse);
                return { role: 'assistant', content: providerList };
            case 'refreshModels':
                const provider = await this.getModelProvider();
                const modelResponse = await this.getModelsByProvider(provider);
                const modelList = JSON.stringify(modelResponse);
                return { role: 'assistant', content: modelList };
            case 'executePipeline':
                return await this.executePipelines();
            default:
                logger.warn(`No message handler found for command: ${message.command}`);
                return { role: 'assistant', content: 'No message handler found.' };
        }
    }

    private async executeLlmChatRequest(text: string, tool_use: boolean = false): Promise<Message> {
        try {
            logger.info(`Executing LLM chat request: ${text.substring(0, 50)}...`);
            const modelName = this.llmClient.model;
            const newMessage: Message = { role: 'user', content: text };
            this.messages.push(newMessage);
            const request: ChatRequest = { model: modelName, messages: this.messages, stream: false };

            if (tool_use || // explicit tool call 
                this.pipelineHandler.pipelines.length == 0) { // first call and so necessarily a tool call
                request.tools = ollamaTools;
                request.messages = [systemMessage, newMessage];
            }

            const response = await this.llmClient.chat(request);

            if (response) {
                if (response.message.tool_calls) {
                    this.createPipeline(response.message.tool_calls);
                    this.messages.push(response.message as ToolMessage); // tool response
                    logger.info(`Tool call ${JSON.stringify(response.message.tool_calls)}`);
                    await this.executePipelines();
                } else {
                    this.messages.push(response.message); // chat responselogger.info(`Successful tool call ${JSON.stringify(response.message.tool_calls)}`);
                    logger.info(`Chat call ${JSON.stringify(response.message)}`);
                }
                return response.message;
            }
        } catch (error) {
            logger.error(`Error communicating with LLM: ${JSON.stringify(error)}`);
            this.sendErrorToPanel('Error communicating with LLM: ' + JSON.stringify(error));
        }
        return { role: 'assistant', content: 'An unexpected error occurred' };
    }

    // Experiment with generate over chat
    private async executeLlmGenerateRequest(text: string, tool_use: boolean = false): Promise<Message> {
        try {
            logger.info(`Executing LLM generate request: ${text.substring(0, 50)}...`);
            const modelName = this.llmClient.model;
            const newMessage: Message = { role: 'user', content: text };
            this.messages.push(newMessage);
            let request: GenerateRequest = { model: modelName, prompt: text, system: systemMessage.content, stream: false, format: "json" };

            const response = await this.llmClient.generate(request);

            if (response) {
                let replyMessage = { role: 'assistant', content: response.response };
                this.messages.push(replyMessage);
                logger.info(`LLM generate request completed successfully`);
                return replyMessage;
            }
        } catch (error) {
            logger.error(`Error communicating with LLM: ${JSON.stringify(error)}`);
            this.sendErrorToPanel('Error communicating with LLM: ' + JSON.stringify(error));
        }
        return { role: 'assistant', content: 'An unexpected error occurred' };
    }

    public async executePipelines(): Promise<Message> {
        logger.info('Executing pipelines');
        const results = await this.pipelineHandler.executePipelines();
        logger.info(`Pipelines execution completed. Pipeline results: ${JSON.stringify(results)}`);
        return { role: 'assistant', content: 'Pipeline executed' };
    }

    private async setModel(model: string) {
        logger.info(`Setting model to: ${model}`);
        await this.llmClient.setModel(model);
    }

    private async setModelProvider(provider: string) {
        logger.info(`Setting model provider to: ${provider}`);
        await this.config.update('provider', provider, vscode.ConfigurationTarget.Global);
        if (!this.llmClient || !this.llmClient.provider || this.llmClient.provider != provider) {
            await this.initializeLlmClient(provider);
        }
        else this.llmClient.provider = provider;
    }

    public async getModelProvider(): Promise<string> {
        if (!this.llmClient) {
            await this.initializeLlmClient();
        }
        return this.llmClient.provider;
    }

    public sendUpdateToPanel(message: any) {
        logger.info(`Sending update to panel: ${JSON.stringify(message).substring(0, 100)}...`);
        this.panel.webview.postMessage({ command: 'receiveMessage', text: message });
    }

    public sendErrorToPanel(errorMessage: string) {
        logger.error(`Sending error to panel: ${errorMessage}`);
        this.panel.webview.postMessage({ command: 'receiveMessage', text: errorMessage });
    }

    private async initializeLlmClient(provider: string = "ollama"): Promise<void> {
        try {
            logger.info(`Initializing LLM client for provider: ${provider}`);
            this.llmClient = await createLlmClient(provider);
            await this.getModelsByProvider(this.llmClient.provider);
        } catch (error) {
            if (error instanceof Error && error.message.includes('API key is not set')) {
                logger.warn(`API key not set for provider: ${provider}`);
                await this.handleApiKeyRequest(provider);
            } else {
                logger.error(`Error initializing LLM client: ${JSON.stringify(error)}`);
                throw error;
            }
        }
    }

    private async handleApiKeyRequest(provider: string): Promise<void> {
        logger.info(`Requesting API key for provider: ${provider}`);
        const apiKey = await vscode.window.showInputBox({
            prompt: `Please enter your ${provider} API key`,
            password: true
        });
        if (apiKey) {
            await this.config.update(`${provider}ApiKey`, apiKey, vscode.ConfigurationTarget.Global);
            this.llmClient = await createLlmClient(provider);
            logger.info(`API key set and LLM client created for provider: ${provider}`);
        } else {
            logger.error(`${provider} API key is required but not provided`);
            throw new Error(`${provider} API key is required`);
        }
    }

    private getProviderList(): string[] {
        const providers = ['ollama', 'claude', 'openai'];
        logger.info(`Provider list: ${providers.join(', ')}`);
        return providers;
    }

    public async getModelsByProvider(provider: string): Promise<string[]> {
        logger.info(`Getting models for provider: ${provider}`);
        if (!this.llmClient || this.llmClient.provider != provider) {
            this.llmClient = await createLlmClient(provider);
        }

        const models = await this.llmClient.getModels();
        logger.info(`Models for provider ${provider}: ${models.join(', ')}`);
        return models;
    }

    private createPipeline(toolCalls: any[]) {
        logger.info(`Creating new pipeline from tool calls: ${JSON.stringify(toolCalls)}`);
        this.pipelineHandler.createPipeline(toolCalls);
    }

    public async exportChatHistory() {
        logger.info('Exporting chat history');
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
                logger.info(`Chat history exported to: ${uri.fsPath}`);
            }
        } catch (error) {
            logger.error(`Failed to export chat history: ${error}`);
            this.sendErrorToPanel('Failed to export chat history: ' + error);
        }
    }

    public async clearChatHistory() {
        logger.info('Clearing chat history');
        this.messages = [systemMessage as ToolMessage];
    }
}