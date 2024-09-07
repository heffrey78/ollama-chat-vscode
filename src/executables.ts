import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import ollama from 'ollama';
import { Orchestrator } from './orchestrator';
import { ollamaTools } from './config/tools';
import { createParser } from 'llm-exe';
import { State } from './pipelineHandler'
import { ExecuteCommand } from './tools/executeCommand';
import { Executable } from './tools/executable';

export class ListFilesTopLevel implements Executable {
    orchestrator: Orchestrator;

    constructor(messageHandler: Orchestrator) {
        this.orchestrator = messageHandler;
    }

    async execute(args: any, cwd: string, state: any): Promise<any> {
        try {
            this.orchestrator.sendUpdateToPanel(`Listing files in: ${args.path}`);
            const dirPath = path.join(cwd, args.path);
            const files = await fs.readdir(dirPath, { withFileTypes: true });
            return { files: files.map(file => file.name) };
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error listing files: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class ListFilesRecursive implements Executable {
    orchestrator: Orchestrator;

    constructor(messageHandler: Orchestrator) {
        this.orchestrator = messageHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            this.orchestrator.sendUpdateToPanel(`Listing files in: ${args.path} (recursive)`);
            const dirPath = path.join(cwd, args.path);
            const files = await this.recursiveReadDir(dirPath);
            return { files };
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error listing files recursively: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    private async recursiveReadDir(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? this.recursiveReadDir(res) : res;
        }));
        return Array.prototype.concat(...files);
    }
}

export class ViewSourceCodeDefinitions implements Executable {
    orchestrator: Orchestrator;

    constructor(messageHandler: Orchestrator) {
        this.orchestrator = messageHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            this.orchestrator.sendUpdateToPanel(`Viewing source code.`);
            // Implement source code parsing logic
            return { definitions: [`class MyClass`, `function myFunction()`] };
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error viewing source code definitions: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class ReadFile implements Executable {
    orchestrator: Orchestrator;

    constructor(messageHandler: Orchestrator) {
        this.orchestrator = messageHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            this.orchestrator.sendUpdateToPanel(`Reading file: ${args.path}`);
            const filePath = path.join(cwd, args.path);
            const content = await fs.readFile(filePath, 'utf-8');
            return { content };
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error reading file: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class WriteToFile implements Executable {
    orchestrator: Orchestrator;

    constructor(messageHandler: Orchestrator) {
        this.orchestrator = messageHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            this.orchestrator.sendUpdateToPanel(`Writing file: ${args.path}`);
            const filePath = path.join(cwd, args.path);
            await fs.writeFile(filePath, args.content, 'utf-8');
            return { status: `File ${filePath} written successfully` };
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error writing to file: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class AttemptCompletion implements Executable {
    orchestrator: Orchestrator;

    constructor(messageHandler: Orchestrator) {
        this.orchestrator = messageHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            vscode.window.showInformationMessage(args.result);
            if (args.command) {
                this.orchestrator.sendUpdateToPanel(`Attempted competion`);
                // Execute the command if provided
                // Implement command execution logic here
            }
            return { status: 'Completion attempted' };
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error attempting completion: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class PipelineCreate implements Executable {
    orchestrator: Orchestrator;
    private pipeline: {
        name: string;
        directoryName: string;
        objectives: string[];
        tasks: any[];
        state: Map<string, string>;
    } | null = null;

    constructor(messageHandler: Orchestrator) {
        this.orchestrator = messageHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            const keywordsPrompt = `
            Given the following user request, identify file names, programming concepts, or frameworks involved in this task.

            User Request: ${args.task}


                # # DO NOT EXPLAIN YOURSELF. 
                # # Your response will go directly into a program, so do not add comments.
                # # Return ONLY the keywords array as a JSON object following this example:
            {
                items: 
                [
                    { 
                        "key": "language", 
                        "value": "e.g. Python, Typescript, Java, C#, etc."  
                    },  
                    {    
                        "key": "framework",    
                        "value": "e.g. Flask, Springboot, Angular, React"  
                    },  
                    {    
                        "key": "environmentManager",    
                        "value": "e.g. venv, nvm, conda, etc."  
                    },  
                    {    
                        "key": "packageManager",    
                        "value": "e.g. pip, npm, yarn, etc."  
                    },  
                    {    
                        "key": "controllerName", 
                        "value": "e.g. userController, boardController, etc."  
                    }, ...more key concepts, frameworks, services, etc.
                ]
            }   
          `;

            //const keywordsResponse = await this.messageHandler.handleToolMessage(keywordsPrompt, false);

            const pipelinePrompt = `
                # Given the following user request:
                1. Ruminate on the user request.
                2. Plan the task architecture and create an array of key concepts that should be adhered to.
                3. Create a plan by creating a list of objectives describing an minimum viable product that will fulfill the request
                4. Fulfill the objectives by breaking them down into small, individually executable tasks.
                5. Enumerate the files that will be created or modified to fulfill an objective.
                6. Each task should have a single, atomic operation that can be performed independently as a commandline operation.
                7. Each task should have at least one validation operation such as checking file existence, running a script, or creating and executing a unit test.

                # System Info:
                - OS: ${os.platform()}
                - Home directory: ${os.homedir()}
                - cwd: ${cwd}
                
                # Available tools: 
                ${JSON.stringify(ollamaTools)}

                User Request: ${args.task}

                # DO: USE CONSISTENT VARIABLE AND FILE NAMING ACROSS ALL TASKS.
                # DO: EXECUTE SCRIPTS BY USING 'cd' TO FIRST NAVIGATE TO THE DESIRED DIRECTORY AND THEN EXECUTE 
                # DO: CREATE OUTPUT THAT IS FORMATTED FOR MACHINE READING
                # DO NOT: EXPLAIN YOURSELF. 
                # Your response will go directly into a program, so do not add comments.
                # Return ONLY the plan as a JSON string strictly following this example:

                {
                    "name": "Project Name",
                    "directoryName": "project_directory_name",
                    "description": "A user friendly description of the project plan using markdown.",
                    "key_concepts": [
                        { 
                            "key": "language", 
                            "value": "e.g. Python, Typescript, Java, C#, etc."  
                        },  
                        {    
                            "key": "framework",    
                            "value": "e.g. Flask, Springboot, Angular, React"  
                        },  
                        {    
                            "key": "environmentManager",    
                            "value": "e.g. venv, nvm, conda, etc."  
                        },  
                        {    
                            "key": "packageManager",    
                            "value": "e.g. pip, npm, yarn, etc."  
                        },  
                        {    
                            "key": "controllerName", 
                            "value": "e.g. userController, boardController, etc."  
                        }, ...more key concepts, frameworks, services, etc.
                    ],
                    "objectives": [
                        {
                            "objective": "Single word identifier for objective (e.g. 'persist_journal_entries', 'research_api_documents', etc.)
                            "description": "Description of the objective (e.g., 'save journal entries to database', etc.)",
                            "file_list": [
                                "{cwd}/{project_directory_name}",
                                "{cwd}/{project_directory_name}/index.html",
                                "{cwd}/{project_directory_name}/src/homecontroler.ts",
                            ],
                        }, ... more objectives
                    ],
                    "tasks": [
                                {
                                    "task": "Description of the objective task including validation methods",
                                    "objective": "Objective related to task (e.g., 'persist_journal_entries', etc.),
                                    "function": {
                                        "name": "Tool to accomplish task (e.g., 'execute_command', 'read_file', 'write_to_file', etc.)",
                                        "working_directory": "Working directory for execution of the function (e.g. '', '~/', 'src/controllers', etc. )",
                                        "arguments": {
                                            // Key/value pairs representing arguments specific to the tool
                                        }
                                    },
                                    "function": {
                                        "name": "Method to validate task completion (e.g., after 'write_to_file' task use 'read_file' to verify, etc.)",
                                        "working_directory": "Working directory for execution of the function (e.g. '', '~/', 'src/controllers', etc. )
                                        "arguments": {
                                            // Key/value pairs representing arguments specific to the tool
                                        }
                                    },
                        }, ... more tasks
                    ],
                }
            `;

            const maxRetries = 3;
            let retryCount = 0;
            let planJson = {};
            let errorMessage: string = "";
            this.orchestrator.sendUpdateToPanel("Attempting to create plan.");

            while (retryCount < maxRetries) {
                try {
                    const failureReply: string = retryCount > 0 ? `Attempt #${retryCount + 1} \n Error from JSON.parse when trying to parse previous response: ${errorMessage}` : ""
                    const message = {command: 'sendMessage', text: pipelinePrompt + failureReply, tool_use: false};
                    const response = await this.orchestrator.handleMessage(message);
                    this.orchestrator.sendUpdateToPanel(`Plan creation attempt ${retryCount + 1}: ${JSON.stringify(response)}`);
                    const trimmedResponse = this.tryParseJson(message.text);
                    planJson = trimmedResponse.json;

                    this.orchestrator.sendUpdateToPanel(`Plan JSON: ${JSON.stringify(planJson)}`);

                    // If we reach this point, the response is valid JSON, so break out of the loop.
                    break;
                } catch (error) {
                    if (error instanceof SyntaxError) {
                        errorMessage = error.message;
                    }

                    if (!(error instanceof SyntaxError)) {
                        // If the error is not due to invalid JSON, rethrow it.        
                        throw error;
                    }

                    retryCount++;

                    if (retryCount === maxRetries) {
                        throw new Error(`Failed to receive valid JSON after ${maxRetries} retries.`);
                    }

                    // Wait for a short duration before retrying to avoid overwhelming the server.
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            }

            this.parsePipeline(JSON.stringify(planJson));


            if (this.pipeline) {
                return this.pipeline; // Return the entire plan object
            } else {
                throw new Error('Failed to parse plan');
            }
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error creating pipeline: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    private tryParseJson(response: string): { success: boolean; json?: any } {
        let trimmedResponse = response.trim();
        const jsonRegex = /^(\{|\[])([\s\S]*?)(\}|])$/;

        if (!jsonRegex.test(trimmedResponse)) {
            // Remove non-JSON content from the beginning and end of the string
            trimmedResponse = trimmedResponse.replace(/^[^\{\[]+|[^\}\]]+$/, '');
        }

        try {
            const json = JSON.parse(trimmedResponse);
            return { success: true, json };
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error creating pipeline: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    private parsePipeline(pipelineString: string,) {
        const parser = createParser('json');
        if (pipelineString.length > 0) {
            const parsedPipeline = parser.parse(pipelineString);
            console.log(JSON.stringify(parsedPipeline));

            this.pipeline = {
                name: parsedPipeline.name,
                directoryName: parsedPipeline.directoryName,
                objectives: parsedPipeline.objectives,
                tasks: parsedPipeline.tasks,
                state: parsedPipeline.key_concepts
            };
        } else {
            console.log('Failed to parse pipeline');
        }
    }

    public getPipeline() {
        return this.pipeline;
    }
}

export class Chat implements Executable {
    orchestrator: Orchestrator;

    constructor(messageHandler: Orchestrator) {
        this.orchestrator = messageHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            const response = await ollama.chat(args.message);
            return { response: response };
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error calling ollama.chat: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class EnsureProjectFolder implements Executable {
    orchestrator: Orchestrator;

    constructor(messageHandler: Orchestrator) {
        this.orchestrator = messageHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            this.orchestrator.sendUpdateToPanel(`Checking project folder: ${args.projectName}`);
            const projectPath = path.join(cwd, args.projectName);
            
            try {
                await fs.access(projectPath);
                return { status: `Project folder ${args.projectName} already exists` };
            } catch (error) {
                // If the folder doesn't exist, create it
                await fs.mkdir(projectPath, { recursive: true });
                return { status: `Project folder ${args.projectName} created successfully` };
            }
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error handling project folder: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export const createTools = (messageHandler: Orchestrator): { [key: string]: Executable } => ({
    execute_command: new ExecuteCommand(messageHandler),
    list_files_top_level: new ListFilesTopLevel(messageHandler),
    list_files_recursive: new ListFilesRecursive(messageHandler),
    view_source_code_definitions_top_level: new ViewSourceCodeDefinitions(messageHandler),
    read_file: new ReadFile(messageHandler),
    write_to_file: new WriteToFile(messageHandler),
    attempt_completion: new AttemptCompletion(messageHandler),
    planner: new PipelineCreate(messageHandler),
    chat: new Chat(messageHandler),
    project_folder: new EnsureProjectFolder(messageHandler),
});

export async function executeTool(name: string, args: any, cwd: string, state: any, messageHandler: Orchestrator): Promise<any> {
    // Trim the name of special characters
    const trimmedName = name.replace(/[^\w\s-]/g, '').trim();

    const trimmedArgs = Object.entries(args).reduce((acc, [key, value]) => {
        if (typeof value === 'string') {
            // Replace newlines with spaces and trim
            acc[key] = value.replace(/\n/g, ' ').trim();
        } else if (typeof value === 'object' && value !== null) {
            // For objects, we'll stringify, replace newlines, then parse back
            acc[key] = JSON.parse(JSON.stringify(value).replace(/\n/g, ' '));
        } else {
            acc[key] = value;
        }
        return acc;
    }, {} as any);

    const toolHandlers = createTools(messageHandler);
    const handler = toolHandlers[trimmedName];
    if (handler) {
        try {
            return await handler.execute(trimmedArgs, cwd, state);
        } catch (error) {
            throw error;
        }
    } else {
        return await toolHandlers['chat'].execute({ message: `${trimmedName}: ${JSON.stringify(trimmedArgs)}` }, cwd, state);
    }
}

export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}
