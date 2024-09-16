import * as path from 'path';
import * as vscode from 'vscode';
import axios, { AxiosError } from 'axios';
import { LlmClient } from './llmClients/llmClient';
import { loadAllProviderConfigs } from './config/config-utils';
import { OpenAIClient } from './llmClients/openAiClient';
import { ClaudeClient } from './llmClients/claudeClient';
import { DynamicLlmClient } from './llmClients/dynamicClient';
import { OllamaClient } from './llmClients/ollamaClient';
import { OllamaCliClient } from './llmClients/ollamaCliClient';
import { Executable, ExecutableArgs, ExecutableReturn } from './tools/executable';
import { Orchestrator } from './orchestrator';
import { PipelineHandler, State } from './pipelineHandler';

export class LlmClientCreator implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;
    private providers: Map<string, LlmClient> = new Map<string, LlmClient>();

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
        this.initializeHandler();
    }

    private async initializeHandler() {
        const providersFromDisc = await loadProviders();
        this.providers = providersFromDisc;
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        if(!args.command) {
            throw new Error('No Llm Client specified.');
        }
        if(!this.providers || this.providers.size == 0) {
            this.providers = await loadProviders();
        }

        const client = this.providers.get(args.command);
        if (!client) {
            throw new Error(`Unsupported LLM provider: ${args.command}`);
        }
    
        return { llmClient: client };
    }

}

// Custom function to handle Axios errors
export function handleAxiosError(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            return `Server error: ${axiosError.response.status} - ${axiosError.response.statusText}`;
        } else if (axiosError.request) {
            // The request was made but no response was received
            return 'No response received from the server. Please check your network connection.';
        } else {
            // Something happened in setting up the request that triggered an Error
            return `Error setting up the request: ${axiosError.message}`;
        }
    }
    // For non-Axios errors
    return `Non-axios error: ${error}`;
}


export function isToolError(llmclient: LlmClient, error: unknown): boolean {
    return error instanceof Error && error.message.includes('does not support tools');
}

export async function loadProviders(): Promise<Map<string, LlmClient>> {
    const providersDir = path.join(__dirname, 'providers');
    const providers = new Map<string, LlmClient>();

    const vscodeConfig = vscode.workspace.getConfiguration('ollama-chat-vscode');

    try {
        const configs = await loadAllProviderConfigs(providersDir);
        for (const config of configs) {

            switch (config.name) {
                case 'ollama':
                    providers.set(config.name, new OllamaClient(config));
                    break;
                case 'ollama-cli':
                    providers.set(config.name, new OllamaCliClient(config));
                    break;
                case 'openai': {
                    const openaiKey = vscodeConfig.get<string>('openaiApiKey') || '';
                    config.apiKey = openaiKey;
                    providers.set(config.name, new OpenAIClient(config));
                    break;             
                }
                case 'claude': {
                    const claudeKey = vscodeConfig.get<string>('claudeApiKey') || '';
                    config.apiKey = claudeKey;
                    providers.set(config.name, new ClaudeClient(config));
                }
                    break;
                default:
                    providers.set(config.name, new DynamicLlmClient(config));
            }
        }
    } catch (error) {
        console.error('Error loading provider configs:', error);
    }

    return providers;
}