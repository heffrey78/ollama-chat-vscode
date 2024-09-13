import * as vscode from 'vscode';
import * as child_process from 'child_process';
import { promisify } from 'util';
import { ChatRequest } from '../chats/chatRequest';
import { ChatResponse } from '../chats/chatResponse';
import { GenerateRequest } from '../chats/generateRequest';
import { GenerateResponse } from '../chats/generateResponse';
import { ProviderConfig } from "../config/providerConfig";
import {
    Ollama,
    ChatRequest as OllamaChatRequest,
    Message as OllamaMessage,
    ChatResponse as OllamaChatResponse,
    ToolCall as OllamaToolCall,
    Tool
} from 'ollama';
import { LlmClient } from "./llmClient";
import { systemMessage } from "../config/systemMessage";
import { handleAxiosError } from "../llmClients";


export class OllamaClient implements LlmClient {
    private config: ProviderConfig;
    private ollama: Ollama;
    models: string[] = [];
    provider: string;
    model: string = "";

    constructor(config: ProviderConfig) {
        this.config = config;
        this.provider = config.name;
        this.model = config.defaultModel;
        this.ollama = new Ollama({
            host: config.url
        });

        this.setModel();
    }

    async chat(params: ChatRequest): Promise<ChatResponse | undefined> {
        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                const chatRequest = this.mapToOllamaRequest(params);
                const response = await this.ollama.chat(chatRequest);

                return this.mapToChatResponse(response);
            } catch (error) {
                
                console.error('Error in Ollama chat:', error);
                const errorMessage = handleAxiosError(error);

                // Check for the specific error message
                if (errorMessage && errorMessage.includes("Unable to determine the device handle for GPU")) {
                    await this.tryRestart();
                }

                retryCount++;

                if (retryCount === maxRetries) {
                    await this.tryRestart();
                    throw new Error(`Failed to receive valid JSON after ${maxRetries} retries.`);
                }
                // Wait for a short duration before retrying to avoid overwhelming the server.
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
    }

    async generate(params: GenerateRequest): Promise<GenerateResponse | undefined> {
        try {
            const response = await this.ollama.generate({
                model: this.model,
                prompt: params.prompt,
                system: systemMessage.content,
                options: { num_ctx: 4096 }
            });

            return {
                model: response.model,
                created_at: new Date(response.created_at),
                response: response.response,
                done: response.done,
                done_reason: response.done_reason,
                context: response.context,
            };
        } catch (error) {
            console.error('Error in Ollama generate:', error);
            throw error;
        }
    }

    async tryRestart() {
        const shouldRestart = await vscode.window.showInputBox({
            prompt: 'Ollama service encountered a GPU error. Would you like to restart the service?',
            placeHolder: 'Yes or No',
            ignoreFocusOut: true
        });

        if (shouldRestart === 'Yes') {
            await this.restartOllamaService();
            // Wait for a moment to allow the service to restart
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    async setModel(model: string = "llama3.1"): Promise<void> {
        this.model = model;
        await vscode.workspace.getConfiguration('ollama-chat-vscode').update('modelName', model, vscode.ConfigurationTarget.Global);
    }

    async getModels(): Promise<string[]> {
        if (!this.models || this.models.length === 0) {
            try {
                const response = await this.ollama.list();
                this.models = response.models.map(model => model.name);
            } catch (error) {
                console.error('Error fetching Ollama models:', error);
                this.models = [];
            }
        }

        return this.models;
    }

    async setModels() {
        this.models = await this.getModels();
    }

    private async restartOllamaService(): Promise<void> {
        // Prompt user for sudo password
        const password = await vscode.window.showInputBox({
            prompt: 'Enter sudo password to restart Ollama service',
            password: true,
            ignoreFocusOut: true
        });

        if (password) {
            // Execute the command
            const command = `echo "${password}" | sudo -S systemctl restart ollama`;

            try {
                const execPromise = promisify(child_process.exec);
                const { stdout, stderr } = await execPromise(command);

                if (stdout) {
                    console.log(`Command output: ${stdout}`);
                }
                if (stderr) {
                    console.log(`Command error: ${stderr}`);
                }


            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(`Error executing command: ${errorMessage}`);
                throw error;
            }
        } else {
            vscode.window.showWarningMessage('Password not provided. Ollama service not restarted.');
        }
    }

    private mapToOllamaRequest(params: ChatRequest): OllamaChatRequest & {
        stream: false
    } {
        const ollamaMessages: OllamaMessage[] = params.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));


        return {
            model: this.model,
            messages: ollamaMessages,
            stream: false,
            options: {
               num_ctx: 2048
            },
            tools: params.tools
        };
    }

    private mapToChatResponse(response: OllamaChatResponse): ChatResponse {
        return {
            model: response.model,
            created_at: new Date(response.created_at),
            message: {
                ...response.message,
                tool_calls: response.message.tool_calls
                    ? this.transformToToolCalls(response.message.tool_calls)
                    : undefined
            },
            done: response.done,
            total_duration: response.total_duration,
            load_duration: response.load_duration,
            prompt_eval_count: response.prompt_eval_count,
            prompt_eval_duration: response.prompt_eval_duration,
            eval_count: response.eval_count,
            eval_duration: response.eval_duration,
            done_reason: response.done_reason, // Include done_reason
        }
    }

private transformToOllamaToolCalls(toolCalls?: Tool[]): OllamaToolCall[] {
        if (!toolCalls) return [];

        const ollamaToolCalls = toolCalls.map(toolCall => ({
            type: "function", // Explicitly set to "function"
            function: {
                name: toolCall.function.name,
                arguments: typeof toolCall.function.parameters === 'string'
                    ? this.parseArguments(toolCall.function.parameters)
                    : toolCall.function.parameters
            }
        } as OllamaToolCall));

        return ollamaToolCalls;
    }

    private transformToToolCalls(toolCalls?: OllamaToolCall[]): ToolCall[]{
        if (!toolCalls) return [];

        return toolCalls.map(toolCall => ({
            id: `call_${Math.random().toString(36).substr(2, 9)}`,
            type: "function", // Explicitly set to "function"
            function: {
                name: toolCall.function.name,
                arguments: typeof toolCall.function.arguments === 'string'
                    ? this.parseArguments(toolCall.function.arguments)
                    : toolCall.function.arguments
            }
        }));
    }

    private parseArguments(args: string): { [key: string]: any } {
        try {
            return JSON.parse(args);
        } catch (error) {
            console.error('Failed to parse function arguments:', error);
            return {}; // Return an empty object if parsing fails
        }
    }
}