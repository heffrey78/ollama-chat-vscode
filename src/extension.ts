import * as vscode from 'vscode';
import { Ollama } from 'ollama';
import fetch from 'node-fetch';
import { MessageHandler } from './messageHandler';

const ollama = new Ollama({ fetch: fetch as any });

async function getModelList(): Promise<string[]> {
    try {
        const response = await ollama.list();
        return response.models.map(model => model.name);
    } catch (error) {
        console.error('Error fetching model list:', error);
        return [];
    }
}

function getWebviewContent(modelList: string[]) {
    const modelOptions = modelList.map(model => `<option value="${model}">${model}</option>`).join('');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ollama Chat</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            #chat-container { height: 65vh; overflow-y: auto; border: 1px solid #ccc; padding: 10px; }
            #input-container { display: flex; margin-top: 20px; }
            #message-input { flex-grow: 1; padding: 10px; }
            #send-button { padding: 10px 20px; }
            #model-select { margin-bottom: 10px; padding: 5px; }
            #button-container { margin-top: 10px; }
            #button-container button { margin-right: 10px; }
        </style>
    </head>
    <body>
        <select id="model-select">
            ${modelOptions}
        </select>
        <div id="chat-container"></div>
        <div id="input-container">
            <input type="text" id="message-input" placeholder="Type your message...">
            <button id="send-button">Send</button>
        </div>
        <div id="button-container">
            <button id="export-button">Export Chat</button>
            <button id="clear-button">Clear Chat</button>
        </div>
        <script>
            const vscode = acquireVsCodeApi();
            const chatContainer = document.getElementById('chat-container');
            const messageInput = document.getElementById('message-input');
            const sendButton = document.getElementById('send-button');
            const modelSelect = document.getElementById('model-select');
            const exportButton = document.getElementById('export-button');
            const clearButton = document.getElementById('clear-button');

            function addMessage(text, isUser = false) {
                const messageElement = document.createElement('p');
                messageElement.textContent = (isUser ? 'You: ' : 'Ollama: ') + text;
                chatContainer.appendChild(messageElement);
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }

            sendButton.addEventListener('click', () => {
                const message = messageInput.value.trim();
                if (message) {
                    addMessage(message, true);
                    vscode.postMessage({ command: 'sendMessage', text: message });
                    messageInput.value = '';
                }
            });

            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    sendButton.click();
                }
            });

            modelSelect.addEventListener('change', (e) => {
                vscode.postMessage({ command: 'setModel', model: e.target.value });
            });

            exportButton.addEventListener('click', () => {
                vscode.postMessage({ command: 'exportChat' });
            });

            clearButton.addEventListener('click', () => {
                vscode.postMessage({ command: 'clearChat' });
                chatContainer.innerHTML = '';
            });

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'receiveMessage':
                        addMessage(message.text);
                        break;
                    case 'chatExported':
                        vscode.window.showInformationMessage('Chat history exported successfully!');
                        break;
                    case 'chatCleared':
                        vscode.window.showInformationMessage('Chat history cleared and reset.');
                        break;
                }
            });
        </script>
    </body>
    </html>`;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Ollama Chat extension is now active!');

    let disposable = vscode.commands.registerCommand('ollama-chat-vscode.startChat', async () => {
        const panel = vscode.window.createWebviewPanel(
            'ollamaChat',
            'Ollama Chat',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        const modelList = await getModelList();
        panel.webview.html = getWebviewContent(modelList);

        const messageHandler = new MessageHandler(panel);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'sendMessage':
                    case 'setModel':
                        await messageHandler.handleMessage(message);
                        break;
                    case 'exportChat':
                        await messageHandler.exportChatHistory();
                        break;
                    case 'clearChat':
                        await messageHandler.clearChatHistory();
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}