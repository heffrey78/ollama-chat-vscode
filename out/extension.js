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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const ollama_1 = require("ollama");
const node_fetch_1 = __importDefault(require("node-fetch"));
const messageHandler_1 = require("./messageHandler");
const ollama = new ollama_1.Ollama({ fetch: node_fetch_1.default });
async function getModelList() {
    try {
        const response = await ollama.list();
        return response.models.map(model => model.name);
    }
    catch (error) {
        console.error('Error fetching model list:', error);
        return [];
    }
}
function getWebviewContent(modelList) {
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
function activate(context) {
    console.log('Ollama Chat extension is now active!');
    let disposable = vscode.commands.registerCommand('ollama-chat-vscode.startChat', async () => {
        const panel = vscode.window.createWebviewPanel('ollamaChat', 'Ollama Chat', vscode.ViewColumn.One, {
            enableScripts: true
        });
        const modelList = await getModelList();
        panel.webview.html = getWebviewContent(modelList);
        const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
        const projectDirectory = config.get('projectDirectory') || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const messageHandler = new messageHandler_1.MessageHandler(panel, projectDirectory);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
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
        }, undefined, context.subscriptions);
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map