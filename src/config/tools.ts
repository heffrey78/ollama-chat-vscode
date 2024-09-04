import { Tool } from 'ollama';
import * as os from 'os';

export const ollamaTools: Tool[] = [
    {
        type: 'function',
        function: {
            name: 'execute_command',
            description: `Execute a CLI command on the local system. Current system info:\n- Platform: ${process.platform}\n- CPU Architecture: ${os.arch()}\n- Node.js Version: ${process.version}\n- System Uptime: ${Math.floor(os.uptime())} seconds`,
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