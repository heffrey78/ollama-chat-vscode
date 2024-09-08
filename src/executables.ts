import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import ollama from 'ollama';
import { Orchestrator } from './orchestrator';
import { ollamaTools } from './config/tools';
import { createParser } from 'llm-exe';
import { PipelineHandler, State } from './pipelineHandler'
import { ExecuteCommand } from './tools/executeCommand';
import { Executable } from './tools/executable';
import { exec } from 'child_process';

export class ListFilesTopLevel implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: any, cwd: string, state: any): Promise<any> {
        try {
            this.orchestrator.sendUpdateToPanel(`Listing files in: ${args.path}`);
            const dirPath = path.join(args.path);
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
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            this.orchestrator.sendUpdateToPanel(`Listing files in: ${args.path} (recursive)`);
            const dirPath = path.join(args.path);
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
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
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
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            this.orchestrator.sendUpdateToPanel(`Reading file: ${args.path}`);
            const filePath = path.join(args.path);
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
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            this.orchestrator.sendUpdateToPanel(`Writing file: ${args.path}`);
            const filePath = path.join(args.path);
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
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
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


export class CreateObjectives implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            const stepName = 'objectives'
            const pipelinePrompt = `
                # Ruminate on the <<USER REQUEST>> below:
                - Create a list of <<OBJECTIVES>> describing a viable solution that will fulfill the <<USER REQUEST>>. These will later be broken down into tasks.

                <<USER REQUEST>>: ${args.task}

                # <<SYSTEM INFO>>:
                - <<OS>>: ${os.platform()}
                - <<HOME DIRECTORY>>: ${os.homedir()}
                
                # <<AVAILABLE TOOLS>>: 
                ${JSON.stringify(ollamaTools)}

                # CREATE OUTPUT THAT IS FORMATTED FOR MACHINE READING
                # DO NOT PROVIDE EXPLANATION 
                # The response will go directly into a program, so no comments are acceptable.
                # Return ONLY the plan as a minified JSON string strictly following this example:

                {
                    "objectives": [ // <<OBJECTIVES>>
                        {
                            "objective": "Single word identifier for objective (e.g. 'persist_journal_entries', 'research_api_documents', etc.)
                            "description": "Description of the objective (e.g., 'save journal entries to database', etc.)",
                            ],
                        }, // ... more objectives
                    ],
                }
                `;

            const objectivespipeLine = await this.pipelineHandler.generatePipelinePart(pipelinePrompt);
            state.set(stepName, JSON.stringify(objectivespipeLine));

            return { status: 'Completion attempted' };
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error attempting completion: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class PlanDirectoryStructure implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            const stepName = 'files'
            const pipelinePrompt = `
                # Ruminate on the <<USER REQUEST>> and planned <<OBJECTIVES>> below:
                - Create <<FILES>> to outline an architecture supports SOLID engineering principles.
                - Collect all <<FILES>>, frameworks, languages, versions, and other important information as key-values in <<CONCEPTS>>.

                <<USER REQUEST>>: ${args.task}

                # <<SYSTEM INFO>>:
                - <<OS>>: ${os.platform()}
                - <<HOME DIRECTORY>>: ${os.homedir()}
                
                # <<AVAILABLE TOOLS>>: 
                ${JSON.stringify(ollamaTools)}

                # CREATE OUTPUT THAT IS FORMATTED FOR MACHINE READING
                # DO NOT PROVIDE EXPLANATION 
                # The response will go directly into a program, so no comments are acceptable.
                # Return ONLY the plan as a minified JSON string strictly following this example:

                {
                    "file_list": [ <<FILES>>
                                    "project_directory_name",
                                    "project_directory_name/index.html",
                                    "project_directory_name/src/homecontroler.ts",
                                ],
                }
                `;

            const filesPipeline = await this.pipelineHandler.generatePipelinePart(pipelinePrompt);
            state.set(stepName, JSON.stringify(filesPipeline));

            return { status: 'Completion attempted' };
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error attempting completion: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class CreateTasks implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        let response = [];
        try {
            const objectives = state.get('objectives');
            if(objectives || args.task) {
                let objectivesJson = JSON.parse(objectives || JSON.stringify([{ objective: args.task }]));

                for(const objective in objectivesJson){
                    const pipelinePrompt = `
                    # Ruminate on the <<USER REQUEST>> below:
                    - Use the provided <<OBJECTIVES>> that describe a viable solution that will fulfill the <<USER REQUEST>> as context.
                    - For the given <<OBJECTIVE>> create one or more <<TASKS>> that will be followed step-by-step to complete the <<OBJECTIVE>> and ultimately the <<USER REQUEST>>. 
                    - Each <<TASK>> must have a single, atomic <<FUNCTION>> that can be performed as an <<AVAILABLE TOOL>> such as a commandline operation (e.g. execute_command, etc.).
                    - Each <<TASK>> must have at least one <<VALIDATING FUNCTION>>. The <<VALIDATING FUNCTION>> should verify that the previous <<FUNCTION>> succeeded.
                    - The <<VALIDATING FUNCTION>> should execute an <<AVAILABLE TOOL>> to checking file existence, running a script, or create and execute a unit test to validate the previous <<FUNCTION>>.
    
                    # <<USER REQUEST>>: ${args.task}
                    # <<OBJECTIVES>>: ${objectives}
                    # <<OBJECTIVE>>: ${objective}
    
                    # <<SYSTEM INFO>>:
                    - <<OS>>: ${os.platform()}
                    - <<HOME DIRECTORY>>: ${os.homedir()}
                    
                    # <<AVAILABLE TOOLS>>: 
                    ${JSON.stringify(ollamaTools)}
    
                    # CREATE OUTPUT THAT IS FORMATTED FOR MACHINE READING
                    # DO NOT PROVIDE EXPLANATION 
                    # The response will go directly into a program, so no comments are acceptable.
                    # Return ONLY the plan as a minified JSON string strictly following this example:
    
                    {
                        "tasks": [ // <<TASKS>>
                                    {
                                        "task": "Description of the objective task including validation methods", // <<TASK>>
                                        "objective_name": "Objective related to task (e.g., 'persist_journal_entries', etc.),
                                        "function": { // <<FUNCTION>>
                                            "name": "Tool to accomplish task (e.g., 'execute_command', 'read_file', 'write_to_file', etc.)",
                                            "working_directory": "Working directory for execution of the function (e.g. '', '~/', 'src/controllers', etc. )",
                                            "arguments": { // <<ARGS>>
                                                // Key-value pairs representing arguments specific to the tool
                                            }
                                        },
                                        "validation": { // <<VALIDATING FUNCTION>>
                                            "name": "Method to validate task completion (e.g., after 'write_to_file' task use 'read_file' to verify, etc.)",
                                            "working_directory": "Working directory for execution of the function (e.g. '', '~/', 'src/controllers', etc. )
                                            "arguments": { // <<ARGS>>
                                                // Key-value pairs representing arguments specific to the tool
                                            }
                                        },
                            }, // ... more tasks
                        ],
                    }
                    `;


                    const taskResponse = await this.pipelineHandler.generatePipelinePart(pipelinePrompt);
                    response.push(taskResponse);
                }
            }

            state.set('tasks', JSON.stringify(response));
            return response;
        } catch (error) {
            this.orchestrator.sendErrorToPanel(`Error attempting completion: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}


export class PipelineCreate implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    private pipeline: {
        name: string;
        directoryName: string;
        objectives: string[];
        tasks: any[];
        state: Map<string, string>;
    } | null = null;

    constructor(messageHandler: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = messageHandler;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: any, cwd: string, state: State): Promise<any> {
        try {
            const pipelinePrompt = `
                # Ruminate on the <<USER REQUEST>> below:
                - In an upcoming task, you will break down the <<USER REQUEST>> in to <<OBJECTIVESS> that have <<TASKS>> that have <<FUNCTIONS>> that have <<ARGS>>.
                - Your current task is: 
                - 1. Write a 200 word or less brief outlining the overarching methodology used to solve the request
                - 2. Provide a name for the project.
                - 3. Provide a projectDirectory name.
                - This is an automated software system. Unless asked for comment, always repond with clean, minified code, JSON, or Markdown as appropriate. 

                # <<SYSTEM INFO>>:
                - <<OS>>: ${os.platform()}
                - <<HOME DIRECTORY>>: ${os.homedir()}
                
                # <<AVAILABLE TOOLS>>: 
                ${JSON.stringify(ollamaTools)}

                <<USER REQUEST>>: ${args.task}

                # DO: CREATE OUTPUT THAT IS FORMATTED FOR MACHINE READING
                # DO NOT: EXPLAIN YOURSELF. 
                # Your response will go directly into a program, so do not add comments.
                # Return ONLY the plan as a JSON string strictly following this example:

                {
                    "name": "User Request Name",
                    "directoryName": "project_directory_name",
                    "brief": "A user friendly description of the project plan using markdown.",
                }
            `;

            const maxRetries = 3;
            let retryCount = 0;
            let planJson = {};
            let errorMessage: string = "";
            this.orchestrator.sendUpdateToPanel("Attempting to create plan.");

            const preplan = await this.pipelineHandler.generatePipelinePart(pipelinePrompt);
            const files = await executeTool('plan_directory_structure', args.task, os.homedir.toString(), state, this.orchestrator, this.pipelineHandler);
            const objectives = await executeTool('create_objectives', args.task, os.homedir.toString(), state, this.orchestrator, this.pipelineHandler);
            const tasks = await executeTool('create_tasks', args.task, os.homedir.toString(), state, this.orchestrator, this.pipelineHandler);

            let parsedTasks = this.tryParseJson(objectives);

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
            trimmedResponse = trimmedResponse.replace(/\}\s+$/, '}');
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
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
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
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
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

export const createTools = (messageHandler: Orchestrator, pipelineHandler: PipelineHandler): { [key: string]: Executable } => ({
    execute_command: new ExecuteCommand(messageHandler, pipelineHandler),
    list_files_top_level: new ListFilesTopLevel(messageHandler, pipelineHandler),
    list_files_recursive: new ListFilesRecursive(messageHandler, pipelineHandler),
    view_source_code_definitions_top_level: new ViewSourceCodeDefinitions(messageHandler, pipelineHandler),
    read_file: new ReadFile(messageHandler, pipelineHandler),
    write_to_file: new WriteToFile(messageHandler, pipelineHandler),
    attempt_completion: new AttemptCompletion(messageHandler, pipelineHandler),
    planner: new PipelineCreate(messageHandler, pipelineHandler),
    chat: new Chat(messageHandler, pipelineHandler),
    project_folder: new EnsureProjectFolder(messageHandler, pipelineHandler),
    create_objectives: new CreateObjectives(messageHandler, pipelineHandler),
    create_tasks: new CreateTasks(messageHandler, pipelineHandler),
    plan_directory_structure: new PlanDirectoryStructure(messageHandler, pipelineHandler),
});

export async function executeTool(name: string, 
    args: any, 
    cwd: string, 
    state: any, 
    orchestrator: Orchestrator, 
    pipelineHandler: PipelineHandler): Promise<any> {
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

    const toolHandlers = createTools(orchestrator, pipelineHandler);
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
