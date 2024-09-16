import * as vscode from 'vscode';
import { Pipeline, PipelineHandler } from './pipelineHandler';
import { ollamaTools } from './config/tools';
import { systemMessage } from './config/systemMessage';
import { Message } from './messages/message';
import { GenerateRequest } from './chats/generateRequest';
import { ChatRequest } from './chats/chatRequest';
import { LlmClient } from './llmClients/llmClient';
import { logger } from './logger';
import { loadProviders } from './llmClients';
import { updateWorkspaceConfig } from './config/config-utils';
import { MessageType } from './messages/messageType';
import { ToolCall } from './pipelines/toolCall';
import { MessageRole } from './messages/messsageRole';

type ToolMessage = Message & { name?: string };

export class Orchestrator {
    private config: vscode.WorkspaceConfiguration;
    private messages: ToolMessage[];
    private pipelineHandler: PipelineHandler;
    private panel: vscode.WebviewPanel;
    private llmClient!: LlmClient;
    private currentProvider: string;

    constructor(panel: vscode.WebviewPanel, config: vscode.WorkspaceConfiguration) {
        this.panel = panel;
        this.config = config;
        this.messages = [systemMessage as ToolMessage];
        this.pipelineHandler = new PipelineHandler(this);
        this.currentProvider = '';
        logger.info('Orchestrator initialized');
    }

    public async handleMessage(message: Message): Promise<Message> {
        logger.info(`Handling message: ${message.command}`);
        switch (message.command as MessageType) {
            case MessageType.SendMessage: {
                const response = await this.executeLlmChatRequest(message.content, message.tool_calls && message.tool_calls.length > 0);
                if(response && response.tool_calls){
                    const pipeline = this.createPipeline(response.tool_calls);
                    logger.info('Pipeline created in orchestrator sendMessage');
                    const pipelineResponseMessage = await this.executePipeline(pipeline);
                    logger.info(`Pipeline completed in orchestrator sendMessage: ${JSON.stringify(pipelineResponseMessage)}`);
                }
                return response;
            }
            case MessageType.Generate: {
                const generationResponse = await this.executeLlmGenerateRequest(message.content);
                return generationResponse;
            }
            case MessageType.SetModel:
                await this.setModel(message.model || "");
                return { role: MessageRole.Assistant, content: 'model set' };
            case MessageType.SetProvider:
                await this.setModelProvider(message.provider || "");
                return { role: MessageRole.Assistant, content: 'provider set' };
            case MessageType.RefreshProviders: {
                const providersResponse = await this.getProviderList();
                const providerList = JSON.stringify(providersResponse);
                return { role: MessageRole.System, content: providerList };
            }
            case MessageType.RefreshModels: {
                const provider = await this.getModelProvider();
                const modelResponse = await this.getModelsByProvider(provider);
                const modelList = JSON.stringify(modelResponse);
                return { role: MessageRole.System, content: modelList };
            }
            default:
                logger.warn(`No message handler found for command: ${message.command}`);
                return { role: MessageRole.Assistant, content: 'No message handler found.' };
        }
    }

    private async executeLlmChatRequest(content: string, tool_use: boolean = false): Promise<Message> {
        try {
            logger.info(`Executing LLM chat request: ${content.substring(0, 50)}...`);
            
            const modelName = this.llmClient.model;

            const newMessage: Message = { role: MessageRole.User, content: content };
            this.addMessage(newMessage);
            
            const request: ChatRequest = { model: modelName, messages: this.messages, stream: false };

            if (tool_use || // explicit tool call 
                this.pipelineHandler.getPipelinesLength() == 0) { // first call and so necessarily a tool call
                request.tools = ollamaTools;
                request.messages = [systemMessage, newMessage];
            }

            const response = await this.llmClient.chat(request);

            if (response) {
                if (response.message.tool_calls) {
                    this.addMessage(response.message); 
                    logger.info(`Tool response ${JSON.stringify(response.message.tool_calls)}`);
                } else {
                    this.addMessage(response.message); // chat responselogger.info(`Successful tool call ${JSON.stringify(response.message.tool_calls)}`);
                    logger.info(`Chat response ${JSON.stringify(response.message)}`);
                }
                return response.message;
            }
        } catch (error) {
            logger.error(`Error communicating with LLM: ${JSON.stringify(error)}`);
            this.sendErrorToPanel('Error communicating with LLM: ' + JSON.stringify(error));
        }
        return { role: MessageRole.Assistant, content: 'An unexpected error occurred' };
    }

    // Experiment with generate over chat
    private async executeLlmGenerateRequest(content: string): Promise<Message> {
        try {
            logger.info(`Executing LLM generate request: ${content.substring(0, 50)}...`);
            const modelName = this.llmClient.model;

            const newMessage: Message = { role: MessageRole.User, content: content };
            this.addMessage(newMessage);
            
            const request: GenerateRequest = { model: modelName, prompt: content, system: systemMessage.content, stream: false, format: "json" };

            const response = await this.llmClient.generate(request);

            if (response) {
                const replyMessage = { role: MessageRole.Assistant, content: response.response, context: response.context };
                this.addMessage(replyMessage);
                logger.info(`LLM generate request completed successfully`);
                return replyMessage;
            }
        } catch (error) {
            logger.error(`Error communicating with LLM: ${JSON.stringify(error)}`);
            this.sendErrorToPanel('Error communicating with LLM: ' + JSON.stringify(error));
        }
        return { role: MessageRole.Assistant, content: 'An unexpected error occurred' };
    }

    public async executePipeline(pipeline: Pipeline): Promise<Message> {
        logger.info('Executing pipelines');
        const results = await this.pipelineHandler.executePipeline(pipeline);
        logger.info(`Pipelines execution completed. Pipeline results: ${JSON.stringify(results)}`);
        return { role: MessageRole.Assistant, content: 'Pipeline executed' };
    }

    private async setModel(model: string) {
        logger.info(`Setting model to: ${model}`);
        await this.llmClient.setModel(model);
    }

    private async setModelProvider(provider: string) {
        try {
            logger.info(`Setting model provider to: ${provider}`);

            await updateWorkspaceConfig(this.config, 'provider', provider);
            
            // Update the current provider in memory
            this.currentProvider = provider;

            if (!this.llmClient || !this.llmClient.provider || this.llmClient.provider != provider) {
                await this.initializeLlmClient(provider);
            }
            else this.llmClient.provider = provider;
        } 
        catch(error) {
            if (error instanceof Error && error.message.includes('Model provider not set')) {
                logger.warn(`Model provider not set for: ${provider}`);
                await this.handleApiKeyRequest(provider);
            } else {
                logger.error(`Error setting model provider: ${JSON.stringify(error)}`);
                throw error;
            }
        }
    }

    public async getModelProvider(): Promise<string> {
        if (!this.llmClient) {
            await this.initializeLlmClient();
        }
        return this.currentProvider || this.llmClient.provider;
    }

    public sendUpdateToPanel(updateText: string) {
        logger.info(`Sending update to panel: ${JSON.stringify(updateText).substring(0, 100)}...`);
        this.panel.webview.postMessage({ command: 'receiveMessage', content: updateText });
    }

    public sendErrorToPanel(errorText: string) {
        logger.error(`Sending error to panel: ${errorText}`);
        this.panel.webview.postMessage({ command: 'receiveMessage', content: errorText });
    }

    private async initializeLlmClient(provider: string = "ollama"): Promise<void> {
        try {
            logger.info(`Initializing LLM client for provider: ${provider}`);
            const args = { command: provider } 
            const response = await this.pipelineHandler.executeAdhocToolCall('llm_client_handler', args);

            if(response && response.llmClient) {
                this.llmClient = response.llmClient as LlmClient;
            }
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
            await vscode.workspace.getConfiguration().update(`ollama-chat-vscode.${provider}ApiKey`, apiKey, vscode.ConfigurationTarget.Global);
            if(!this.llmClient || this.llmClient.provider != provider) {
                await this.initializeLlmClient(provider);
            }

            logger.info(`API key set and LLM client created for provider: ${provider}`);
        } else {
            logger.error(`${provider} API key is required but not provided`);
            throw new Error(`${provider} API key is required`);
        }
    }

    private async getProviderList(): Promise<string[]> {
        return await this.getProviderNames();
    }

    async getProviderNames(): Promise<string[]> {
        const providers = await loadProviders();
        return Array.from(providers.keys());
    }

    public async getModelsByProvider(provider: string): Promise<string[]> {
        logger.info(`Getting models for provider: ${provider}`);
        if (!this.llmClient || this.llmClient.provider != provider) {
            await this.initializeLlmClient(provider);
        }

        const models = await this.llmClient.getModels();
        this.llmClient.models = models;
        logger.info(`Models for provider ${provider}: ${models.join(', ')}`);
        return models;
    }

    private createPipeline(toolCalls: ToolCall[]): Pipeline {
        logger.info(`Creating new pipeline from tool calls: ${JSON.stringify(toolCalls)}`);
        const pipeline = this.pipelineHandler.createPipeline(toolCalls);
        this.pipelineHandler.addPipeline(pipeline);
        return pipeline;
    }

    private isToolMessage(response: Message): response is ToolMessage {
        return (response as ToolMessage).name !== undefined;
    }

    private addMessage(message: Message) {
        this.messages.push(message);
    }
    
    public async exportChatHistory() {
        logger.info('Exporting chat history');
        const chatHistory = this.messages.map(msg => {
            if (msg.role === 'user') {
                return `User: ${msg.content}`;
            } else if (msg.role === MessageRole.Assistant) {
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