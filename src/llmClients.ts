import * as path from 'path';
import axios, { AxiosError } from 'axios';
import { LlmClient } from './llmClients/llmClient';
import { loadAllProviderConfigs } from './config/config-utils';
import { OpenAIClient } from './llmClients/openAiClient';
import { ClaudeClient } from './llmClients/claudeClient';
import { DynamicLlmClient } from './llmClients/dynamicClient';
import { OllamaClient } from './llmClients/ollamaClient';
import { OllamaClitClient as OllamaCliClient } from './llmClients/ollamaCliClient';

export async function loadProviders(): Promise<Map<string, LlmClient>> {
    const providersDir = path.join(__dirname, 'providers');
    const providers = new Map<string, LlmClient>();

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
                case 'openai':
                    providers.set(config.name, new OpenAIClient(config));
                    break;
                case 'claude':
                    providers.set(config.name, new ClaudeClient(config));
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

export async function createLlmClient(provider: string): Promise<LlmClient> {
    const providers = await loadProviders();
    const client = providers.get(provider);
    if (!client) {
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    return client;
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
    return `Non-axios error: ${JSON.stringify(error)}`;
}