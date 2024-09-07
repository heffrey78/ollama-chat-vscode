"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const orchestrator_1 = require("./orchestrator");
function getWebviewContent() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>LLM Chat</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            #chat-container { height: 60vh; overflow-y: auto; border: 1px solid #ccc; padding: 10px; }
            #input-container { display: flex; margin-top: 20px; }
            #message-input { flex-grow: 1; padding: 10px; }
            #send-button { padding: 10px 20px; }
            #provider-select, #model-select { margin-bottom: 10px; padding: 5px; }
            #button-container { margin-top: 10px; }
            #button-container button { margin-right: 10px; }
        </style>
    </head>
    <body>
        <select id="provider-select">
            <option value="ollama">Ollama</option>
            <option value="claude">Claude</option>
            <option value="openai">OpenAI</option>
        </select>
        <select id="model-select"></select>
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
            const providerSelect = document.getElementById('provider-select');
            const modelSelect = document.getElementById('model-select');
            const exportButton = document.getElementById('export-button');
            const clearButton = document.getElementById('clear-button');

            function addMessage(text, isUser = false) {
                const messageElement = document.createElement('p');
                messageElement.textContent = (isUser ? 'You: ' : 'LLM: ') + text;
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

            providerSelect.addEventListener('change', (e) => {
                vscode.postMessage({ command: 'setProvider', provider: e.target.value });
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
                    case 'updateProviders':
                        providerSelect.innerHTML = message.providers.map(provider => 
                            '<option value="' + provider + '">' + provider + '</option>'
                        ).join('');
                        break;
                    case 'updateModels':
                        modelSelect.innerHTML = message.models.map(model => 
                            '<option value="' + model + '">' + model + '</option>'
                        ).join('');
                        break;
                    case 'chatExported':
                        vscode.window.showInformationMessage('Chat history exported successfully!');
                        break;
                    case 'chatCleared':
                        vscode.window.showInformationMessage('Chat history cleared and reset.');
                        break;
                }
            });

            // Initial provider and model refresh
            vscode.postMessage({ command: 'refreshProviders' });
            vscode.postMessage({ command: 'refreshModels' });
        </script>
    </body>
    </html>`;
}
function activate(context) {
    console.log('LLM Chat extension is now active!');
    let disposable = vscode.commands.registerCommand('ollama-chat-vscode.startChat', async () => {
        const panel = vscode.window.createWebviewPanel('llmChat', 'LLM Chat', vscode.ViewColumn.One, {
            enableScripts: true
        });
        panel.webview.html = getWebviewContent();
        const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
        const projectDirectory = config.get('projectDirectory') || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const orchestrator = new orchestrator_1.Orchestrator(panel, config, projectDirectory);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'exportChat':
                    await orchestrator.exportChatHistory();
                    panel.webview.postMessage({ command: 'chatExported', text: 'Chat exported' });
                    break;
                case 'clearChat':
                    await orchestrator.clearChatHistory();
                    panel.webview.postMessage({ command: 'chatCleared', text: 'Chat cleared' });
                    break;
                case 'sendMessage':
                    const response = await orchestrator.handleMessage(message);
                    panel.webview.postMessage({ command: 'receiveMessage', text: response });
                    break;
                case 'refreshProviders':
                    const providersResponse = await orchestrator.handleMessage(message);
                    const providers = JSON.parse(providersResponse.content);
                    panel.webview.postMessage({ command: 'updateProviders', providers: providers });
                    break;
                case 'refreshModels':
                    const modelsResponse = await orchestrator.handleMessage(message);
                    const models = JSON.parse(modelsResponse.content);
                    const provider = orchestrator.getModelProvider();
                    panel.webview.postMessage({ command: 'setProvider', provider: provider });
                    panel.webview.postMessage({ command: 'updateModels', models: models });
                    break;
                case 'setModel':
                    await orchestrator.handleMessage(message);
                    panel.webview.postMessage({ command: 'setModel', model: message });
                    break;
                case 'setProvider':
                    await orchestrator.handleMessage(message);
                    panel.webview.postMessage({ command: 'setProvider', provider: message.provider });
                    const setModels = await orchestrator.getModelsByProvider(message.provider);
                    panel.webview.postMessage({ command: 'updateModels', models: setModels });
                    panel.webview.html = getWebviewContent();
                    break;
                default:
                    await orchestrator.handleMessage(message);
                    break;
            }
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map