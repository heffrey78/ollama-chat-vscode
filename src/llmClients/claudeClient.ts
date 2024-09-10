import axios, { AxiosInstance } from "axios";
import { ChatRequest } from '../chats/chatRequest';
import { ChatResponse } from '../chats/chatResponse';
import { GenerateRequest } from '../chats/generateRequest';
import { GenerateResponse } from '../chats/generateResponse';
import { ProviderConfig } from "../config/providerConfig";
import { LlmClient } from "./llmClient";
import * as vscode from 'vscode';

export class ClaudeClient implements LlmClient {
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
        return undefined;
    }

    async setModel(model: string = "claude-3-5-sonnet-20240620"): Promise<void> {
        this.model = model;
        await vscode.workspace.getConfiguration('ollama-chat-vscode').update('modelName', model, vscode.ConfigurationTarget.Global);
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