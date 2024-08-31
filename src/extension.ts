import * as vscode from 'vscode';
import { Ollama, Tool } from 'ollama';
import fetch from 'node-fetch';
import * as os from 'os';
import { PipelineHandler } from './pipelineHandler';

const ollama = new Ollama({ fetch: fetch as any });

function getWorkingDirectory(): string {
    const config = vscode.workspace.getConfiguration('ollama-chat-vscode');
    const configuredDir = config.get('workingDirectory') as string;
    return configuredDir || os.homedir();
}

const ollamaTools: Tool[] = [
    {
        type: 'function',
        function: {
            name: 'execute_command',
            description: 'Execute a CLI command on the system.',
            parameters: {
                type: 'object',
                properties: {
                    command: {
                        type: 'string',
                        description: 'The CLI command to execute.'
                    }
                },
                required: ['command']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_files_top_level',
            description: 'List all files and directories at the top level of the specified directory.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'The path of the directory to list contents for.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_files_recursive',
            description: 'Recursively list all files and directories within the specified directory.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'The path of the directory to recursively list contents for.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'view_source_code_definitions_top_level',
            description: 'Parse all source code files at the top level of the specified directory to extract names of key elements like classes and functions.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'The path of the directory to parse top level source code files for to view their definitions.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'read_file',
            description: 'Read the contents of a file at the specified path.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'The path of the file to read.'
                    }
                },
                required: ['path']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'write_to_file',
            description: 'Write content to a file at the specified path.',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'The path of the file to write to.'
                    },
                    content: {
                        type: 'string',
                        description: 'The content to write to the file.'
                    }
                },
                required: ['path', 'content']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'ask_followup_question',
            description: 'Ask the user a question to gather additional information.',
            parameters: {
                type: 'object',
                properties: {
                    question: {
                        type: 'string',
                        description: 'The question to ask the user.'
                    }
                },
                required: ['question']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'attempt_completion',
            description: 'Present the result of a task to the user.',
            parameters: {
                type: 'object',
                properties: {
                    result: {
                        type: 'string',
                        description: 'The result of the task.'
                    },
                    command: {
                        type: 'string',
                        description: 'The CLI command to execute to show a live demo of the result to the user.'
                    }
                },
                required: ['result']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'planner',
            description: 'Generate a plan for completing a task.',
            parameters: {
                type: 'object',
                properties: {
                    task: {
                        type: 'string',
                        description: 'The task to plan for.'
                    }
                },
                required: ['task']
            }
        }
    }
];

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
        <script>
            const vscode = acquireVsCodeApi();
            const chatContainer = document.getElementById('chat-container');
            const messageInput = document.getElementById('message-input');
            const sendButton = document.getElementById('send-button');
            const modelSelect = document.getElementById('model-select');

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

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'receiveMessage':
                        addMessage(message.text);
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

        let messages: any[] = [];
        const pipelineHandler = new PipelineHandler();

        const systemMessage = {
            role: 'system',
            content: `You are an AI assistant focused on excelling at software engineering tasks, including product development, planning, and problem-solving. Your capabilities include:

1. Breaking down complex problems into manageable chunks.
2. Thinking logically and methodically about software development tasks.
3. Asking clarifying questions when there are missing pieces of information.
4. Being intuitive about software design and architecture.
5. Utilizing a range of tool-calling capabilities to assist with various tasks.

You have access to several tools that can help you accomplish tasks. Always try to match your skills and available tools with the user's needs. When no clear coding task or tool use can be determined, engage in a helpful chat to clarify the user's requirements or provide general software engineering advice.

Remember to:
- Plan before executing, especially for complex tasks.
- Use your tool-calling capabilities when appropriate.
- Ask for clarification if a task or requirement is ambiguous.
- Provide explanations for your decisions and approaches.
- Offer best practices and design patterns when relevant.

Your goal is to assist users in creating high-quality, efficient, and well-structured software solutions.`
        };

        // Add the system message to the beginning of the messages array
        messages.push(systemMessage);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'sendMessage':
                        try {
                            const config = 
                            vscode.workspace.getConfiguration('ollama-chat-vscode');
                            const modelName = config.get('modelName') as string;
                            messages.push({ role: 'user', content: message.text });
                            const response = await ollama.chat({
                                model: modelName,
                                messages: messages,
                                tools: ollamaTools,
                            });
                            messages.push(response.message);
                            panel.webview.postMessage({ command: 'receiveMessage', text: response.message.content });

                            // Handle tool calls
                            if (response.message.tool_calls) {
                                pipelineHandler.clearPipeline();
                                for (const toolCall of response.message.tool_calls) {
                                    pipelineHandler.addToolCall(toolCall);
                                }

                                const cwd = getWorkingDirectory();
                                const results = await pipelineHandler.executePipeline(cwd);

                                for (let i = 0; i < results.length; i++) {
                                    const toolCall = response.message.tool_calls[i];
                                    const result = results[i];
                                    messages.push({ role: 'tool', content: JSON.stringify(result), name: toolCall.function.name });
                                    panel.webview.postMessage({ command: 'receiveMessage', text: `Tool ${toolCall.function.name} executed. Result: ${JSON.stringify(result)}` });
                                }

                                // Get a follow-up response after tool calls
                                const followUpResponse = await ollama.chat({
                                    model: modelName,
                                    messages: messages,
                                    tools: ollamaTools,
                                });
                                messages.push(followUpResponse.message);
                                panel.webview.postMessage({ command: 'receiveMessage', text: followUpResponse.message.content });
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage('Error communicating with Ollama: ' + error);
                        }
                        return;
                    case 'setModel':
                        await vscode.workspace.getConfiguration('ollama-chat-vscode').update('modelName', message.model, vscode.ConfigurationTarget.Global);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}