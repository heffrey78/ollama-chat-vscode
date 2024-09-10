import * as child_process from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode'
import { GenerateResponse } from '../chats/generateResponse';
import { GenerateRequest } from '../chats/generateRequest';
import { ChatResponse } from '../chats/chatResponse';
import { ChatRequest } from '../chats/chatRequest';
import { LlmClient } from './llmClient';
import { ProviderConfig } from '../config/providerConfig';

export class OllamaClitClient implements LlmClient {
    private config: ProviderConfig;
    models: string[] = [];
    provider: string;
    model: string = "";

    constructor(config: ProviderConfig) {
        this.config = config;
        this.provider = config.name;
        this.model = config.defaultModel;

        this.setModel();
    }

    async chat(params: ChatRequest): Promise<ChatResponse | undefined> {
        const prompt = params.messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
        const command = `ollama run ${this.model} "${prompt}"`;

        try {
            const execPromise = promisify(child_process.exec);
            const { stdout, stderr } = await execPromise(command);

            if (stdout) {
                console.log(`Command output: ${stdout}`);
            }
            if (stderr) {
                console.log(`Command error: ${stderr}`);
            }

            return this.parseCliOutput(stdout);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`Error executing command: ${errorMessage}`);
            throw error;
        }
    }

    async generate(params: GenerateRequest): Promise<GenerateResponse | undefined> {
        const command = `ollama run ${this.model} "${params.prompt}"`;

        try {
            const execPromise = promisify(child_process.exec);
            const { stdout, stderr } = await execPromise(command);

            if (stdout) {
                console.log(`Command output: ${stdout}`);
            }
            if (stderr) {
                console.log(`Command error: ${stderr}`);
            }

            return this.parseCliOutput(stdout);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`Error executing command: ${errorMessage}`);
            throw error;
        }
    }

    async setModel(model: string = "llama3.1"): Promise<void> {
        this.model = model;
        await vscode.workspace.getConfiguration('ollama-chat-vscode').update('modelName', model, vscode.ConfigurationTarget.Global);
    }

    async getModels(): Promise<string[]> {
        if (this.models.length === 0) {
            await this.setModels();
        }
        return this.models;
    }

    async setModels(): Promise<void> {
        try {
            const execPromise = promisify(child_process.exec);
            const { stdout, stderr } = await execPromise('ollama list');
    
            if (stdout) {
                console.log(`Command output: ${stdout}`);
            }
            if (stderr) {
                console.log(`Command error: ${stderr}`);
            }
    
            this.models = stdout.split('\n')
                .slice(1)  // Skip the first line (header)
                .filter(line => line.trim() !== '')
                .map(line => line.split(' ')[0]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`Error executing getting models: ${errorMessage}`);
            throw error;
        }
    }

    private parseCliOutput(output: string): ChatResponse & GenerateResponse {
        // Note: This is a simplified parsing. Actual CLI output may require more complex parsing.
        return {
            model: this.model,
            created_at: new Date(),
            message: { role: 'assistant', content: output.trim() },
            response: output.trim(),
            done: true,
            done_reason: 'done',
            context: [],
            total_duration: 0,  // These values are not provided by CLI
            load_duration: 0,
            prompt_eval_count: 0,
            prompt_eval_duration: 0,
            eval_count: 0,
            eval_duration: 0,
        };
    }
}