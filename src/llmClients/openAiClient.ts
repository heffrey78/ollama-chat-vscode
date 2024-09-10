import axios, { AxiosInstance } from "axios";
import { ChatRequest } from '../chats/chatRequest';
import { ChatResponse } from '../chats/chatResponse';
import { GenerateRequest } from '../chats/generateRequest';
import { GenerateResponse } from '../chats/generateResponse';
import { ProviderConfig } from "../config/providerConfig";
import { ollamaTools, Tool } from "../config/tools";
import { LlmClient } from "./llmClient";
import { OpenAIFunction } from './openAIFunction';
import * as vscode from 'vscode';

export class OpenAIClient implements LlmClient {
    private apiKey: string = "";
    private config: ProviderConfig;
    private apiClient: AxiosInstance;
    models: string[] = [];
    provider: string;
    model: string = "";

    constructor(config: ProviderConfig) {
        this.config = config;
        this.provider = config.name;
        this.model = config.defaultModel;
        this.apiKey = config.apiKey || "";
        this.apiClient = axios.create({
            baseURL: config.url,
            headers: { 'Content-Type': 'application/json' }
        });

        this.setModel();
    }

    async chat(params: ChatRequest): Promise<ChatResponse> {
        const functions: OpenAIFunction[] = ollamaTools.map((tool: Tool) => ({
            name: tool.function.name,
            description: tool.function.description,
            parameters: {
                type: 'object',
                properties: tool.function.parameters.properties,
                required: tool.function.parameters.required
            }
        }));

        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: this.model,
                messages: params.messages,
                functions: functions,
                function_call: 'auto',
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
            }
        );

        const message = response.data.choices[0].message;
        let toolCalls: { id: string; type: string; function: { name: string; arguments: string } }[] = [];

        if (message.function_call) {
            toolCalls = [{
                id: 'call_' + Math.random().toString(36).substr(2, 9),
                type: 'function',
                function: {
                    name: message.function_call.name,
                    arguments: message.function_call.arguments
                }
            }];
        }

        return {
            model: this.model,
            created_at: new Date(),
            message: {
                ...message,
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
    }

    async generate(params: GenerateRequest): Promise<GenerateResponse | undefined> {
        return undefined;
    }

    async setModel(model: string = "gpt-3.5-turbo"): Promise<void> {
        this.model = model;
        await vscode.workspace.getConfiguration('ollama-chat-vscode').update('modelName', model, vscode.ConfigurationTarget.Global);
    }

    async getModels(): Promise<string[]> {
        if (!this.models || this.models.length == 0) {
            try {
                const response = await axios.get('https://api.openai.com/v1/models', {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                    },
                });

                return response.data.data
                    .filter((model: any) => model.id.startsWith('gpt-'))
                    .map((model: any) => model.id);
            } catch (error) {
                console.error('Error fetching OpenAI models:', error);
                return [];
            }
        }

        return this.models;
    }

    async setModels() {
        this.models = await this.getModels();
    }
}