import * as vscode from 'vscode';
import { Ollama, Message, ChatResponse, ChatRequest } from 'ollama';
import axios from 'axios';
import { ollamaTools, Tool } from './config/tools';

export interface LlmClient {
    model: string;
    models: string[];
    provider: string;
    chat(params: ChatRequest): Promise<ChatResponse>;
    setModel(model: string): Promise<void>;
    getModels(): Promise<string[]>;
    setModels(): Promise<void>;
}

export class OllamaClient implements LlmClient {
    private ollama: Ollama;
    models: string[] = [];
    provider: string;
    model: string = "";

    constructor() {
        this.ollama = new Ollama({ fetch: fetch as any });
        this.setModel();
        this.provider = "ollama"
    }

    async chat(params: ChatRequest): Promise<ChatResponse> {
        if (params.stream === true) {
            throw new Error("Streaming is not supported in this implementation");
        }
        return this.ollama.chat({
            ...params,
            stream: false
        });
    }

    async setModel(model: string = "llama3.1"): Promise<void> {
        this.model = model;
        await vscode.workspace.getConfiguration('ollama-chat-vscode').update('modelName', model, vscode.ConfigurationTarget.Global);
    }

    async getModels(): Promise<string[]> {
        if (!this.models || this.models.length == 0) {
            const response = await this.ollama.list();
            this.models = response.models.map(model => model.name);
        }

        return this.models;
    }

    async setModels() {
        if(!this.models){
            this.models = await this.getModels();
        }  
    }
}

export class ClaudeClient implements LlmClient {
    private apiKey: string;
    models: string[] = [];
    provider: string;
    model: string = "";

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.setModel();
        this.provider = 'claude';
    }

    async chat(params: ChatRequest): Promise<ChatResponse> {
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

interface OpenAIFunction {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: Record<string, unknown>;
        required: string[];
    };
}

export class OpenAIClient implements LlmClient {
    private apiKey: string;
    models: string[] = [];
    provider: string;
    model: string = "";

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.provider = "openai";
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

export async function createLlmClient(provider: string = 'ollama'): Promise<LlmClient> {
    const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
    let client: LlmClient;

    switch (provider.toLowerCase()) {
        case 'ollama':
            client = new OllamaClient();
            break;
        case 'claude':
            const claudeApiKey = config.get('claudeApiKey') as string;
            if (!claudeApiKey) {
                throw new Error('Claude API key is not set');
            }
            client = new ClaudeClient(claudeApiKey);
            break;
        case 'openai':
            const openaiApiKey = config.get('openaiApiKey') as string;
            if (!openaiApiKey) {
                throw new Error('OpenAI API key is not set');
            }
            client = new OpenAIClient(openaiApiKey);
            break;
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    try {
        // Fetch and cache the models
        const models = await client.getModels();
    } catch (error) {
        console.log(JSON.stringify(error));
    }

    return client;
}