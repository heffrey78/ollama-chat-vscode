import { Tool } from 'ollama';
import * as os from 'os';

export { Tool };

export const ollamaTools: Tool[] = [
    {
        type: 'function',
        function: {
            name: 'execute_command',
            description: `Execute a CLI command on the local system. Current system info: Platform: ${process.platform} - CPU Architecture: ${os.arch()} - System Uptime: ${Math.floor(os.uptime())} seconds`,
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
            name: 'planner',
            description: 'Generate a plan for completing a user request. Used for complex request and multi-tool calls.',
            parameters: {
                type: 'object',
                properties: {
                    task: {
                        type: 'string',
                        description: 'The request to plan for.'
                    }
                },
                required: ['task']
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
            name: 'web_search',
            description: 'Perform a web search using a specified provider and return the top 5 results.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query to execute.'
                    },
                    provider: {
                        type: 'string',
                        description: 'The search provider to use (google, brave, or duckduckgo). Defaults to duckduckgo if not specified.',
                        enum: ['google', 'brave', 'duckduckgo']
                    }
                },
                required: ['query']
            }
        }
    }
];
