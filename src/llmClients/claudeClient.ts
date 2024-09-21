import axios, { AxiosInstance, AxiosError } from "axios";
import { ChatRequest } from '../chats/chatRequest';
import { ChatResponse } from '../chats/chatResponse';
import { GenerateRequest } from '../chats/generateRequest';
import { GenerateResponse } from '../chats/generateResponse';
import { ProviderConfig } from "../config/providerConfig";
import { LlmClient } from "./llmClient";
import * as vscode from 'vscode';
import { updateWorkspaceConfig } from "../config/config-utils";
import { systemMessage } from "../config/systemMessage";
import { logger } from "../logger";
import { ToolCall } from "../pipelines/toolCall";
import { Tool } from "../config/tools";

interface ClaudeTool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, { type: string; description: string }>;
            required: string[];
        };
    };
}

export class ClaudeClient implements LlmClient {
    private apiKey: string = "";
    private config: ProviderConfig;
    private apiClient: AxiosInstance;
    models: string[];
    provider: string;
    model: string;

    constructor(config: ProviderConfig) {
        logger.info(`Initializing ClaudeClient with config: ${JSON.stringify(config, null, 2)}`);
        this.config = config;
        this.models = [];
        this.provider = config.name;
        this.model = config.defaultModel;
        this.setApiKey();
        this.apiClient = axios.create({
            baseURL: 'https://api.anthropic.com',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
                'anthropic-version': '2023-06-01'
            }
        });

        this.setModel();
        logger.info('ClaudeClient initialized');
    }

    private setApiKey(): void {
        logger.info('Setting Claude API key');
        const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
        this.apiKey = config.get('claudeApiKey') || "";
        if (!this.apiKey) {
            const errorMessage = 'Claude API key is not set. Please set it in the extension settings.';
            logger.error(errorMessage);
            vscode.window.showErrorMessage(errorMessage);
        } else {
            logger.info(`Claude API key set: ${this.apiKey.substring(0, 5)}...`);
        }
    }

    private convertToolsToClaudeFormat(tools: Tool[]): ClaudeTool[] {
        logger.info(`Converting ${tools.length} tools to Claude format`);
        const convertedTools = tools.map(tool => ({
            type: 'function' as const,
            function: {
                name: tool.function.name,
                description: tool.function.description,
                parameters: {
                    type: 'object',
                    properties: tool.function.parameters.properties,
                    required: tool.function.parameters.required || []
                }
            }
        }));
        logger.info(`Converted tools: ${JSON.stringify(convertedTools, null, 2)}`);
        return convertedTools as ClaudeTool[];
    }

    async chat(params: ChatRequest): Promise<ChatResponse | undefined> {
        try {
            logger.info(`Sending chat request to Claude API using model: ${this.model}`);
            logger.info(`Chat request params: ${JSON.stringify(params, null, 2)}`);
            const claudeTools = this.convertToolsToClaudeFormat(params.tools || []);
            
            const requestBody = {
                model: this.model,
                messages: params.messages,
                max_tokens: 1000,
                temperature: 0.7,
                system: systemMessage.content,
                tools: claudeTools
            };
            logger.info(`Request body: ${JSON.stringify(requestBody, null, 2)}`);

            const response = await this.apiClient.post('/v1/messages', requestBody);

            logger.info(`Received response from Claude API with status: ${response.status}`);


            const content = response.data.content[0];
            let toolCalls: ToolCall[] | undefined = undefined;

            if (content.type === 'tool_calls') {
                toolCalls = content.tool_calls.map((call: any, index: number) => ({
                    id: `call_${index}`,
                    type: 'function',
                    function: {
                        name: call.function.name,
                        arguments: JSON.parse(call.function.arguments)
                    }
                }));

                if (toolCalls && toolCalls.length > 0) {
                    logger.info(`Tool calls detected: ${toolCalls.map(call => call.function.name).join(', ')}`);
                }
            }

            const chatResponse: ChatResponse = {
                model: this.model,
                created_at: new Date(),
                message: {
                    role: 'assistant',
                    content: content.type === 'text' ? content.text : '',
                    tool_calls: toolCalls
                },
                done: true,
                done_reason: 'stop',
                total_duration: 0,
                load_duration: 0,
                prompt_eval_count: 0,
                prompt_eval_duration: 0,
                eval_count: 0,
                eval_duration: 0,
            };

            logger.info(`Returning chat response: ${JSON.stringify(chatResponse, null, 2)}`);
            return chatResponse;
        } catch (error) {
            this.handleApiError(error);
            return undefined;
        }
    }

    async generate(params: GenerateRequest): Promise<GenerateResponse | undefined> {
        try {
            logger.info(`Sending generate request to Claude API using model: ${params.model || this.model}`);

            const requestBody = {
                model: params.model || this.model,
                messages: [{ role: 'user', content: params.prompt }],
                max_tokens: 1000,
                temperature: 0.7,
            };
            logger.info(`Request body: ${JSON.stringify(requestBody, null, 2)}`);

            const response = await this.apiClient.post('/v1/messages', requestBody);
    
            logger.info(`Received response from Claude API with status: ${JSON.stringify(response.data, null, 2)}`);

            const content = response.data.content[0];
            const generateResponse: GenerateResponse = {
                response: content.text,
                model: response.data.model,
                done_reason: 'stop',
                context: []
            };

            logger.info(`Returning generate response: ${JSON.stringify(generateResponse, null, 2)}`);
            return generateResponse;
        } catch (error) {
            this.handleApiError(error);
            return undefined;
        }
    }

    private handleApiError(error: unknown): void {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            logger.error(`Full error object: ${JSON.stringify(axiosError, null, 2)}`);
            vscode.window.showErrorMessage(`Error calling Claude API: ${axiosError.message}`);
        } else {
            const errorMessage = `Unexpected error calling Claude API: ${(error as Error).message}`;
            logger.error(`Full error object: ${JSON.stringify(error, null, 2)}`);
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    async simulateToolCall(prompt: string): Promise<ChatResponse | undefined> {
        throw new Error("Not implemented");
    }

    async setModel(model: string = "claude-3-5-sonnet-20240620"): Promise<void> {
        this.model = model;
        const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
        await updateWorkspaceConfig(config, 'modelName', model);
        logger.info(`Claude model set to: ${model}`);
    }

    async getModels(): Promise<string[]> {
        const models = [
            "claude-3-5-sonnet-20240620",
            "claude-3-opus-20240229",
            "claude-3-haiku-20240307"
        ];
        logger.info(`Available Claude models: ${JSON.stringify(models, null, 2)}`);
        return models;
    }

    async setModels() {
        this.models = await this.getModels();
        logger.info(`Claude models set: ${this.models.join(', ')}`);
    }
}