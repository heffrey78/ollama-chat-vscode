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
exports.ollamaTools = void 0;
const os = __importStar(require("os"));
exports.ollamaTools = [
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
    },
    {
        type: 'function',
        function: {
            name: 'project_folder',
            description: 'Check if a project folder exists, and create it if it does not.',
            parameters: {
                type: 'object',
                properties: {
                    projectName: {
                        type: 'string',
                        description: 'The name of the project folder to check or create.'
                    }
                },
                required: ['projectName']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_objectives',
            description: 'Given a user request, returns an array of objectives that will be used to organize its completion.',
            parameters: {
                type: 'object',
                properties: {
                    request: {
                        type: 'string',
                        description: 'The user request'
                    }
                },
                required: ['request']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_tasks',
            description: 'Given an objective, returns tasks that will be used to complete the objective',
            parameters: {
                type: 'object',
                properties: {
                    objective: {
                        type: 'string',
                        description: 'The objective to fulfill'
                    }
                },
                required: ['request']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'plan_directory_structure',
            description: 'Given a user request, returns a file architecture that will be used to complete the objective',
            parameters: {
                type: 'object',
                properties: {
                    objective: {
                        type: 'string',
                        description: 'The objective to fulfill'
                    }
                },
                required: ['request']
            }
        }
    },
];
//# sourceMappingURL=tools.js.map