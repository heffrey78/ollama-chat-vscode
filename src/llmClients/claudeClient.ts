import axios, { AxiosInstance } from "axios";
import { ChatRequest } from '../chats/chatRequest';
import { ChatResponse } from '../chats/chatResponse';
import { GenerateRequest } from '../chats/generateRequest';
import { GenerateResponse } from '../chats/generateResponse';
import { ProviderConfig } from "../config/providerConfig";
import { LlmClient } from "./llmClient";
import * as vscode from 'vscode';
import { updateWorkspaceConfig } from "../config/config-utils";

export class ClaudeClient implements LlmClient {
    private apiKey: string = "";
    private config: ProviderConfig;
    private apiClient: AxiosInstance;
    models: string[];
    provider: string;
    model: string;

    constructor(config: ProviderConfig) {
        this.config = config;
        this.models = [];
        this.provider = config.name;
        this.model = config.defaultModel;
        this.apiClient = axios.create({
            baseURL: config.url,
            headers: { 'Content-Type': 'application/json' }
        });

        this.setModel();
    }
    async chat(params: ChatRequest): Promise<ChatResponse | undefined> {
        const response = await axios.post(
            'https://api.anthropic.com/v1/chat/completions',
            {
                model: this.model,
                messages: params.messages,
                max_tokens_to_sample: 1000,
                tools: params.tools
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey,
                },
            }
        );

        return {
            model: this.model,
            created_at: new Date(),
            message: response.data.choices[0].message,
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
        try {
            const response = await axios.post(
                'https://api.anthropic.com/v1/complete',
                {
                    prompt: params.prompt,
                    model: params.model || 'claude-v1',
                    max_tokens_to_sample: 1000,
                    temperature: 0.7,
                    top_p: 1,
                    stop_sequences: [],
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': process.env.CLAUDE_API_KEY,
                    },
                }
            );
    
            return {
                response: response.data.completion,
                model: response.data.model,
                done_reason: response.data.stop_reason,
                context: response.data.context
            };
        } catch (error) {
            console.error('Error calling Claude API:', error);
            return undefined;
        }
    }

    async simulateToolCall(prompt: string): Promise<ChatResponse | undefined> {

        throw new Error("Not implemented");
    }

    async setModel(model: string = "claude-3-5-sonnet-20240620"): Promise<void> {
        this.model = model;
        const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
        await updateWorkspaceConfig(config, 'modelName', model);
    }

    async getModels(): Promise<string[]> {
        return [
            "claude-3-5-sonnet-20240620",
            "claude-3-opus-20240229",
            "claude-3-haiku-20240307"
        ];
    }

    async setModels() {
        this.models = await this.getModels();
    }
}