import * as vscode from 'vscode';
import { Ollama } from 'ollama';
import { PipelineHandler } from './pipelineHandler';
import { ollamaTools } from './config/tools';
import { systemMessage } from './config/systemMessage';

const ollama = new Ollama({ fetch: fetch as any });

export class MessageHandler {
    private messages: any[];
    private pipelineHandler: PipelineHandler;
    private panel: vscode.WebviewPanel;
    private projectDirectory: string;

    constructor(panel: vscode.WebviewPanel, projectDirectory: string) {
        this.panel = panel;
        this.messages = [systemMessage];
        this.pipelineHandler = new PipelineHandler(this);
        this.projectDirectory = projectDirectory;
    }

    public async handleMessage(message: any) {
        switch (message.command) {
            case 'sendMessage':
                await this.handleSendMessage(message.text);
                break;
            case 'setModel':
                await this.handleSetModel(message.model);
                break;
        }
    }

    public updateUser(message: any) {
        this.messages.push({ role: 'tool', content: message });
        this.panel.webview.postMessage({ command: 'receiveMessage', text: message });
    }

    private async handleSendMessage(text: string) {
        try {
            const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
            const modelName = config.get('modelName') as string;
            this.messages.push({ role: 'user', content: text });
            const response = await ollama.chat({
                model: modelName,
                messages: this.messages,
                tools: ollamaTools,
            });
            this.messages.push(response.message);
            this.panel.webview.postMessage({ command: 'receiveMessage', text: response.message.content });

            if (response.message.tool_calls) {
                await this.handleToolCalls(response.message.tool_calls, modelName);
            }
        } catch (error) {
            this.handleErrorMessage('Error communicating with Ollama: ' + error);
        }
    }

    private async handleToolCalls(toolCalls: any[], modelName: string) {
        //this.pipelineHandler.clearPipeline();
        for (const toolCall of toolCalls) {
            this.pipelineHandler.addToolCall(toolCall);
        }

        const results = await this.pipelineHandler.executePipeline(this.projectDirectory);

        for (let i = 0; i < results.length; i++) {
            const toolCall = toolCalls[i];
            const result = results[i];
            this.messages.push({ role: 'tool', content: JSON.stringify(result), name: toolCall.function.name });
            this.panel.webview.postMessage({ command: 'receiveMessage', text: `Tool ${toolCall.function.name} executed. Result: ${JSON.stringify(result)}` });
        }

        // Get a follow-up response after tool calls
        const followUpResponse = await ollama.chat({
            model: modelName,
            messages: this.messages,
            tools: ollamaTools,
        });
        this.messages.push(followUpResponse.message);
        this.panel.webview.postMessage({ command: 'receiveMessage', text: followUpResponse.message.content });
    }

    private async handleSetModel(model: string) {
        await vscode.workspace.getConfiguration('ollama-chat-vscode').update('modelName', model, vscode.ConfigurationTarget.Global);
    }

    public async handleToolMessage(text: string, useTools: boolean): Promise<string> {
        try {
            const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
            const modelName = config.get('modelName') as string;
            const messages = [systemMessage, { role: 'user', content: text }];
            const response = await ollama.chat({
                model: modelName,
                messages: messages,
                tools: useTools ? ollamaTools : undefined,
            });
            return response.message.content;
        } catch (error) {
            return `Error communicating with Ollama: ${error}`;
        }
    }

    public async exportChatHistory() {
        const chatHistory = this.messages.map(msg => {
            if (msg.role === 'user') {
                return `User: ${msg.content}`;
            } else if (msg.role === 'assistant') {
                return `Ollama: ${msg.content}`;
            } else if (msg.role === 'system') {
                return `System: ${msg.content}`;
            } else if (msg.role === 'tool') {
                return `Tool (${msg.name}): ${msg.content}`;
            }
            return '';
        }).join('\n\n');

        try {
            const uri = await vscode.window.showSaveDialog({
                filters: {
                    'Markdown': ['md']
                },
                saveLabel: 'Export Chat History'
            });

            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(chatHistory, 'utf8'));
                this.panel.webview.postMessage({ command: 'chatExported' });
            }
        } catch (error) {
            this.handleErrorMessage('Failed to export chat history: ' + error);
        }
    }

    public async clearChatHistory() {
        this.messages = [systemMessage];
        this.panel.webview.postMessage({ command: 'chatCleared' });
    }

    public handleErrorMessage(errorMessage: string) {
        this.panel.webview.postMessage({ command: 'receiveErrorMessage', text: errorMessage });
    }
}