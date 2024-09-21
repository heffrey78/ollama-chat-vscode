import * as vscode from 'vscode';
import * as os from 'os';
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
} from 'ollama';
import { LlmClient } from "./llmClient";
import { systemMessage } from "../config/systemMessage";
import { handleAxiosError, isToolError } from "../llmClients";
import { updateWorkspaceConfig } from '../config/config-utils';
import { ollamaTools } from '../config/tools';
import { ToolCall } from '../pipelines/toolCall';
import { MessageTools } from '../messages/messageTools';

interface TaskFunction {
    name: string;
    working_directory: string;
    arguments: Record<string, unknown>;
}

interface Task {
    task: string;
    objective_name: string;
    function: TaskFunction;
}

interface ResponseWithTasks {
    tasks: Task[];
}

export class OllamaClient implements LlmClient {
    private config: ProviderConfig;
    private ollama: Ollama;
    private messageTools: MessageTools;
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
        this.messageTools = new MessageTools();

        this.setModel();
    }

    // Existing methods remain unchanged

    async chat(params: ChatRequest): Promise<ChatResponse | undefined> {
        const maxRetries = 5;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                params.messages.forEach(x => x.content = this.prepareStringForLLM(x.content).trimStart())
                const chatRequest = this.mapToOllamaRequest(params);
                const response = await this.ollama.chat(chatRequest);

                return this.mapToChatResponse(response);
            } catch (error) {
                if(isToolError(this, error)) {
                    const prompt = this.prepareStringForLLM(params.messages[1].content);
                    const response = await this.simulateToolCall(prompt); 
                    if(response) {
                        return response;
                    }
                }

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
        const maxRetries = 5;
        let retryCount = 0;

        while (retryCount < maxRetries) {
            try {
                params.prompt = this.prepareStringForLLM(params.prompt);
                const content = systemMessage.content;
                const response = await this.ollama.generate({
                    model: this.model,
                    prompt: params.prompt,
                    system: content,
                    format: "json",
                    options: { num_ctx: 2048 }
                });

                return {
                    model: response.model,
                    response: response.response,
                    done_reason: response.done_reason,
                    context: response.context,
                };
            } catch (error) {
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

    async simulateToolCall(prompt: string): Promise<ChatResponse | undefined> {
        const toolSelectionPrompt = `
        {
          "instructions": [
          "Act as a JSON formatter",
          "Use output_format as a schema", 
          "Adhere to all constraints", 
          "Utilize system_info", 
          "Analyze the user_request", 
          "From available_tools, choose one tool that will fulfill the user_request",
          "Provide parameters appropriate to the tool, system, and request",
          "If the user_request a query for information or does not require a tool, respond normally",
          "If the user_request is complex use the 'planner' tool and only the 'planner' tool"
            ],
          "output_format": {
            "type": "json",
            "structure": {
              "toolCalls": [ 
                {
                "id": "string", 
                "type": "function", 
                "function": {
                    "name": "string", // name of function to call
                    "arguments": 
                    { 
                        [key: string]: any // key-value pairs representing function argument names and values
                    };
                },
                }
              ]
            }
          },
          "constraints": [
            "The tool must be a single, atomic function",
            "Only use tools that are directly relevant to the request",
            "Prefer the planning tool for complex tasks.",
          ],
            "system_info": {
                "os": "${os.platform()}",
                "home_directory": "${os.homedir()}",
                "available_tools": ${JSON.stringify(ollamaTools)}
            },
          "user_request": "${prompt}"
        }
        `;

        try {
            prompt = this.prepareStringForLLM(prompt);
            const request: GenerateRequest = { 
                model: this.model, 
                prompt: toolSelectionPrompt, 
                system: systemMessage.content, 
                stream: false, 
                format: "json" 
            };
            const response = await this.generate(request);
            
            if (response) {
                const toolCalls = await this.messageTools.multiAttemptJsonParse(JSON.stringify(response.response));

                let transformedToolCalls = this.transformToToolCalls(toolCalls.json);

                // Check if there's more than one tool call and if 'planner' exists
                if (transformedToolCalls.length > 1 && transformedToolCalls.some(call => call.function.name === 'planner')) {
                    transformedToolCalls = transformedToolCalls.filter(call => call.function.name === 'planner');
                }

                const chatResponse: ChatResponse = {
                    model: response.model,
                    created_at: new Date(),
                    message: { 
                        role: 'assistant', 
                        content: response.response, 
                        tool_calls: transformedToolCalls
                    },
                    done: true,
                    done_reason: response.done_reason,
                    total_duration: 0,
                    load_duration: 0,
                    prompt_eval_count: 0,
                    prompt_eval_duration: 0,
                    eval_count: 0,
                    eval_duration: 0,
                }
                return chatResponse;
            } else {
                throw new Error("No valid response received from the model");
            }
        } catch (error) {
            console.error('Error in simulateToolCall:', error);
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
        const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
        await updateWorkspaceConfig(config, 'modelName', model);
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
                num_ctx: 2048,
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

    private transformToToolCalls(toolCalls?: OllamaToolCall[]): ToolCall[] {
        try {
            if (!toolCalls) return [];

            return [{
                id: `call_${Math.random().toString(36).substr(2, 9)}`,
                type: 'function', 
                function: {
                    name: toolCalls[0].function.name,
                    arguments: typeof toolCalls[0].function.arguments === 'string'
                        ? this.parseArguments(toolCalls[0].function.arguments)
                        : toolCalls[0].function.arguments
                }
            }];
        } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(`Error transforming tool calls: ${errorMessage}`);
                throw error;
        }
    }

    private transformTasksToToolCalls(response: ResponseWithTasks): ToolCall[] {
        try {
            if (!response || !response.tasks) return [];

            return response.tasks.map((task: Task, index: number) => ({
                id: `call_${index}`,
                type: "function",
                function: {
                    name: task.function.name,
                    arguments: task.function.arguments
                }
            }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`Error transforming tasks to tool calls: ${errorMessage}`);
            throw error;
        }
    }

    private parseArguments(args: string): Record<string, unknown> {
        try {
            return JSON.parse(args);
        } catch (error) {
            console.error('Failed to parse function arguments:', error);
            return {}; // Return an empty object if parsing fails
        }
    }

    private prepareStringForLLM(input: string): string {
        // Create a more comprehensive character map
        const charMap: { [key: string]: string } = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            "'": '&#39;',
            '"': '&quot;',
            '`': '&#96;',
            '/': '&#47;',
            '\\': '&#92;'
        };

        return input
            // Replace special characters with HTML entities
            .replace(/[<>&'"\\`]/g, char => charMap[char] || char)
            // Remove control characters
            .replace(/[\u0000-\u001F\u007F-\u009F]/gu, '')
            // Normalize whitespace
            .replace(/\s+/g, ' ')
            // Trim leading and trailing whitespace
            .trim()
            // Escape any remaining backslashes and quotes
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
    }
}
