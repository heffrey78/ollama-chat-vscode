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
const child_process = __importStar(require("child_process"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const orchestrator_1 = require("./orchestrator");
const messageType_1 = require("./messages/messageType");
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
        <select id="provider-select"></select>
        <select id="model-select"></select>
        <div id="chat-container"></div>
        <div id="input-container">
            <input type="text" id="message-input" placeholder="Type your message...">
            <button id="send-button">Send</button>
        </div>
        <div id="button-container">
            <button id="export-button">Export Chat</button>
            <button id="clear-button">Clear Chat</button>
            <button id="add-provider-button">Add Provider</button>
            <button id="update-ollama-button">Update Ollama</button>
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
            const addProviderButton = document.getElementById('add-provider-button');
            const updateOllamaButton = document.getElementById('update-ollama-button');

            addProviderButton.addEventListener('click', () => {
                vscode.postMessage({ command: 'addProvider' });
            });

            updateOllamaButton.addEventListener('click', () => {
                vscode.postMessage({ command: 'updateOllama' });
            });

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
                    vscode.postMessage({ command: 'sendMessage', content: message });
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
                        addMessage(message.content);
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
                    case 'setProvider':
                        providerSelect.value = message.provider;
                        break;
                    case 'setModel':
                        modelSelect.value = message.model;
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
    const disposable = vscode.commands.registerCommand('ollama-chat-vscode.startChat', async () => {
        const panel = vscode.window.createWebviewPanel('llmChat', 'LLM Chat', vscode.ViewColumn.One, {
            enableScripts: true
        });
        panel.webview.html = getWebviewContent();
        const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
        const orchestrator = new orchestrator_1.Orchestrator(panel, config);
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case messageType_1.MessageType.ExportChat:
                    await orchestrator.exportChatHistory();
                    panel.webview.postMessage({ command: 'chatExported', content: 'Chat exported' });
                    break;
                case messageType_1.MessageType.ClearChat:
                    await orchestrator.clearChatHistory();
                    panel.webview.postMessage({ command: 'chatCleared', content: 'Chat cleared' });
                    break;
                case messageType_1.MessageType.SendMessage: {
                    const response = await orchestrator.handleMessage(message);
                    panel.webview.postMessage({ command: 'receiveMessage', content: response.content });
                    break;
                }
                case messageType_1.MessageType.RefreshProviders: {
                    const providersResponse = await orchestrator.handleMessage(message);
                    const providers = JSON.parse(providersResponse.content);
                    panel.webview.postMessage({ command: 'updateProviders', providers: providers });
                    break;
                }
                case messageType_1.MessageType.RefreshModels: {
                    const modelsResponse = await orchestrator.handleMessage(message);
                    const models = JSON.parse(modelsResponse.content);
                    const provider = await orchestrator.getModelProvider();
                    panel.webview.postMessage({ command: 'setProvider', provider: provider });
                    panel.webview.postMessage({ command: 'updateModels', models: models });
                    break;
                }
                case messageType_1.MessageType.SetModel:
                    await orchestrator.handleMessage(message);
                    panel.webview.postMessage({ command: 'setModel', model: message.model });
                    break;
                case messageType_1.MessageType.SetProvider: {
                    await orchestrator.handleMessage(message);
                    panel.webview.postMessage({ command: 'setProvider', provider: message.provider });
                    const setModels = await orchestrator.getModelsByProvider(message.provider);
                    panel.webview.postMessage({ command: 'updateModels', models: setModels });
                    break;
                }
                case messageType_1.MessageType.AddProvider:
                    await addProvider(context);
                    break;
                case messageType_1.MessageType.UpdateOllama:
                    await updateOllama();
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
// Define type guards
function isValidApiType(value) {
    return ['Ollama', 'OpenAI', 'Claude'].includes(value);
}
function isValidCapability(value) {
    return ['text', 'tool', 'image', 'embedding'].includes(value);
}
async function addProvider(context) {
    const name = await vscode.window.showInputBox({ prompt: 'Enter provider name' });
    const url = await vscode.window.showInputBox({ prompt: 'Enter provider URL' });
    const apiKey = await vscode.window.showInputBox({ prompt: 'Enter API key (optional)', password: true });
    const apiTypeInput = await vscode.window.showQuickPick(['Ollama', 'OpenAI', 'Claude'], { placeHolder: 'Select API type' });
    const capabilitiesInput = await vscode.window.showQuickPick(['text', 'tool', 'image', 'embedding'], { canPickMany: true, placeHolder: 'Select capabilities' });
    if (name && url && apiTypeInput && capabilitiesInput) {
        // Convert apiType to the correct type
        const apiType = isValidApiType(apiTypeInput) ? apiTypeInput : 'Ollama'; // Default to 'Ollama' if invalid
        // Convert capabilities to the correct type
        const capabilities = capabilitiesInput.filter(isValidCapability);
        const config = {
            name,
            url,
            apiType,
            capabilities,
            defaultModel: '',
            ...(apiKey && { apiKey })
        };
        const providersDir = path_1.default.join(context.extensionPath, 'providers');
        if (!fs_1.default.existsSync(providersDir)) {
            fs_1.default.mkdirSync(providersDir);
        }
        const filePath = path_1.default.join(providersDir, `${name}.json`);
        fs_1.default.writeFileSync(filePath, JSON.stringify(config, null, 2));
        vscode.window.showInformationMessage(`Provider ${name} added successfully.`);
    }
}
async function updateOllama() {
    // Prompt user for sudo password
    const password = await vscode.window.showInputBox({
        prompt: 'Enter sudo password to update Ollama',
        password: true,
        ignoreFocusOut: true
    });
    if (password) {
        // Execute the command
        const command = `echo "${password}" | sudo -S bash -c "curl -fsSL https://ollama.com/install.sh | sh"`;
        try {
            const execPromise = (0, util_1.promisify)(child_process.exec);
            const { stdout, stderr } = await execPromise(command);
            if (stdout) {
                console.log(`Command output: ${stdout}`);
                vscode.window.showInformationMessage('Ollama updated successfully.');
            }
            if (stderr) {
                console.log(`Command error: ${stderr}`);
                vscode.window.showErrorMessage(`Error updating Ollama: ${stderr}`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`Error executing command: ${errorMessage}`);
            vscode.window.showErrorMessage(`Error updating Ollama: ${errorMessage}`);
            throw error;
        }
    }
    else {
        vscode.window.showWarningMessage('Password not provided. Ollama update cancelled.');
    }
}
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map