import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Orchestrator } from '../orchestrator';
import { ollamaTools } from '../config/tools';
import { createParser } from 'llm-exe';
import { Pipeline, PipelineHandler, State } from '../pipelineHandler'
import { ExecuteCommand } from './executeCommand';
import { Executable, ExecutableArgs, ExecutableReturn } from './executable';
import { logger } from '../logger';
import { Message } from '../messages/message';
import { LlmClientCreator } from '../llmClients';
import { WebSearch } from './webSearch';
import { OpenMeteoWeather } from './openMeteoWeather';
import { MessageTools } from '../messages/messageTools';


export class OpenMeteoWeatherExecutable implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;
    private openMeteoWeather: OpenMeteoWeather;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
        this.openMeteoWeather = new OpenMeteoWeather();
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Executing OpenMeteoWeather with args: ${JSON.stringify(args)}`);
            this.orchestrator.sendUpdateToPanel(`Fetching weather data...`);
            if(args.key_value_pairs) {
                if(args.key_value_pairs.has('latitude') && args.key_value_pairs.has('longitude')) {
                    const result = await this.openMeteoWeather.execute(args.key_value_pairs.get('latitude') || '', args.key_value_pairs.get('longitude') || '');
                    state.set('weather', result);
                    logger.info('OpenMeteoWeather executed successfully');
                    return { results: [result] };
                }
            }
            return { results: []}
        } catch (error) {
            logger.error(`Error executing OpenMeteoWeather: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error executing OpenMeteoWeather: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class WebSearchExecutable implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;
    webSearch: WebSearch;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
        this.webSearch = new WebSearch();
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Executing web search with query: ${args.query}`);
            this.orchestrator.sendUpdateToPanel(`Executing web search: ${args.query}`);
            const results = await this.webSearch.search(args.query || "", args.provider);
            logger.info('Web search executed successfully');
            const resultStrings: string[] = [];
            results.forEach(x => resultStrings.push(x.url))
            state.set(args.query || "", resultStrings.toString());
            return { results: resultStrings };
        } catch (error) {
            logger.error(`Error executing web search: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error executing web search: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class ListFilesTopLevel implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Listing files in: ${args.path}`);
            this.orchestrator.sendUpdateToPanel(`Listing files in: ${args.path}`);
            const dirPath = path.join(args.path || os.homedir.toString());
            const files = await fs.readdir(dirPath, { withFileTypes: true });
            state.set(dirPath, files.map(x => x).join("\n"));
            logger.info(`Successfully listed ${files.length} files`);
            return { files: files.map(file => file.name) };
        } catch (error) {
            logger.error(`Error listing files: ${getErrorMessage(error)}`);
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

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Listing files in: ${args.path} (recursive)`);
            this.orchestrator.sendUpdateToPanel(`Listing files in: ${args.path} (recursive)`);
            const dirPath = path.join(args.path || os.homedir.toString());
            const files = await this.recursiveReadDir(dirPath);
            state.set(dirPath, files.map(x => x).join("\n"));
            logger.info(`Successfully listed ${files.length} files recursively`);
            return { files };
        } catch (error) {
            logger.error(`Error listing files recursively: ${getErrorMessage(error)}`);
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

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info('Viewing source code definitions');
            this.orchestrator.sendUpdateToPanel(`Viewing source code.`);
            // Implement source code parsing logic
            logger.info('Source code definitions viewed successfully');
            return { results: [`class MyClass`, `function myFunction()`] };
        } catch (error) {
            logger.error(`Error viewing source code definitions: ${getErrorMessage(error)}`);
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

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Reading file: ${args.path}`);
            this.orchestrator.sendUpdateToPanel(`Reading file: ${args.path}`);
            const filePath = path.join(args.path || os.homedir.toString());
            const content = await fs.readFile(filePath, 'utf-8');
            state.set(filePath, content);
            logger.info(`File ${args.path} read successfully`);
            return { results: [content] };
        } catch (error) {
            logger.error(`Error reading file: ${getErrorMessage(error)}`);
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

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Writing file: ${args.path}`);
            this.orchestrator.sendUpdateToPanel(`Writing file: ${args.path}`);
            const filePath = path.join(args.path || os.homedir.toString());
            state.set(filePath, args.message.content);
            await fs.writeFile(filePath, args.message.content, 'utf-8');
            logger.info(`File ${filePath} written successfully`);
            return { results: [`File ${filePath} written successfully`] };
        } catch (error) {
            logger.error(`Error writing to file: ${getErrorMessage(error)}`);
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

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info('Attempting completion');
            vscode.window.showInformationMessage(args.task || "");
            if (args.command) {
                logger.info(`Executing command: ${args.command}`);
                this.orchestrator.sendUpdateToPanel(`Attempted completion for state: ${JSON.stringify(state.entries())}`);
                // Execute the command if provided
                // Implement command execution logic here
            }
            logger.info('Completion attempted successfully');
            return { results: ['Completion attempted'] };
        } catch (error) {
            logger.error(`Error attempting completion: ${getErrorMessage(error)}`);
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

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info('Creating objectives');
            this.orchestrator.sendUpdateToPanel(`Creating objectives`);
            const stepName = 'objectives'
            const pipelinePrompt = `{
                "instructions": "Analyze the USER_REQUEST and create a list of OBJECTIVES describing a viable solution. These objectives will later be broken down into tasks. Double check that objectives serve the request, are achieveable, and in order",
                "user_request": "${args.task}",
                "system_info": {
                  "os": "${os.platform()}",
                  "home_directory": "${os.homedir()}",
                  "available_tools": ${JSON.stringify(ollamaTools)}
                },
                "output_format": {
                  "type": "json",
                  "structure": {
                    "objectives": [
                      {
                        "objective": "Single word identifier for objective",
                        "description": "Description of the objective"
                      }
                    ]
                  }
                },
                "constraints": [
                  "Output must be formatted for machine reading",
                  "Provide only JSON output, no explanations or comments",
                  "Return a complete, minified JSON object"
                ],
                "examples": {
                  "objective_identifier": ["persist_journal_entries", "research_api_documents"],
                  "objective_description": ["Save journal entries to database", "Gather information on relevant APIs"]
                }
              }`;

            const objectivespipeLine = await this.pipelineHandler.generatePipelinePart(pipelinePrompt);
            state.set(stepName, JSON.stringify(objectivespipeLine));

            logger.info('Objectives created successfully');
            return { results: ['Completion attempted'] };
        } catch (error) {
            logger.error(`Error creating objectives: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error creating objectives: ${getErrorMessage(error)}`);
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

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info('Planning directory structure');
            this.orchestrator.sendUpdateToPanel(`Planning directory structure`);
            const stepName = 'files'
            const pipelinePrompt = `{
                "instructions": "Analyze the USER_REQUEST and OBJECTIVES to create a sensible file structure for that will meet the needs of the request. Double check that best practices are followed in the construction of the file system and that it meets the request and objectives.",
                "user_request": "${args.task}",
                "objectives": "${state.get('objectives') || 'no objectives'}",
                "system_info": {
                  "os": "${os.platform()}",
                  "home_directory": "${os.homedir()}"
                },
                "output_format": {
                  "type": "json",
                  "structure": {
                  "project_directory_name": "${state.get('projectDirectory') || ""}"
                    file_list: [
                      "project_directory_name",
                      "project_directory_name/file1.ext",
                      "project_directory_name/directory/file2.ext"
                    ]
                  }
                },
                "constraints": [
                  "Output must be formatted for machine reading",
                  "Provide only JSON output, no explanations or comments",
                  "Return a complete, minified JSON object"
                ]
              }`;

            const filesPipeline = await this.pipelineHandler.generatePipelinePart(pipelinePrompt);
            state.set(stepName, JSON.stringify(filesPipeline));

            logger.info('Directory structure planned successfully');
            return { results: ['Completion attempted'] };
        } catch (error) {
            logger.error(`Error planning directory structure: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error planning directory structure: ${getErrorMessage(error)}`);
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

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        const response = [];
        try {
            logger.info('Creating tasks');
            this.orchestrator.sendUpdateToPanel(`Creating tasks`);
            const objectives = state.get('objectives');
            if(objectives || args.task) {
                const objectivesJson = JSON.parse(objectives || JSON.stringify([{ objective: args.task }]));

                for(const objective in objectivesJson.parameters.request){
                    const pipelinePrompt = `
                    {
                    "instructions": "Analyze the USER_REQUEST and OBJECTIVE to create an array of tasks that will be executed and validated in order so that the objective is met. Double check results for accuracy, order of execution, and achievement of the objective",
                    "output_format": {
                        "type": "json",
                        "schema": {
                            "tasks": [
                                {
                                    "task": "string", // Description of the task
                                    "objective_name": "string", // Name of the related objective
                                    "function": {
                                        "name": "string", // Name of the function to execute
                                        "working_directory": "string", // Directory for function execution
                                        "arguments": {}
                                },
                                {
                                    "task": "string", // Description of validating task
                                    "function": {
                                        "name": "string", // Name of the validation function
                                        "working_directory": "string",  //Directory for validation execution
                                        "arguments": {}
                                },
                            ]
                        }
                    },
                    "constraints": [
                        "Each task must have a single, atomic function",
                        "Each task must have at least one validating function",
                        "Use available tools such as execute_command for functions",
                        "Validating functions should verify the success of the previous function"
                    ],
                    "system_info": {
                        "os": "${os.platform()}",
                        "home_directory": "${os.homedir()}",
                        "available_tools": ${JSON.stringify(ollamaTools)}
                    },
                    "user_request": "${args.task}",
                    "objective": "${objective}"
                    }
                    `;

                    const taskResponse = await this.pipelineHandler.generatePipelinePart(pipelinePrompt);
                    response.push(taskResponse);
                }
            }

            state.set('tasks', JSON.stringify(response));
            logger.info('Tasks created successfully');
            return { results: response };
        } catch (error) {
            logger.error(`Error creating tasks: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error creating tasks: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export class CreatePlanPipeline implements Executable {
    private messageTools: MessageTools;
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.messageTools = new MessageTools();
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {

        if(!args.task) {
            throw new Error('No task.');
        }

        try {
            logger.info('Creating pipeline');
            this.orchestrator.sendUpdateToPanel(`Creating pipeline`);
            const pipelinePrompt = `
                {
                    "instructions": [
                        "Analyze the provided 'user_request'.",
                        "Execute the tasks listed in the 'tasks' array."
                    ],
                    "tasks": [
                        "Devise a strategy to fulfill the 'user_request'.",
                        "Create a 'brief' (maximum 200 words) outlining how the 'user_request' will be fulfilled.",
                        "Create an appropriate project 'name'.",
                        "Create an appropriate project 'directoryName'.",
                        "Return the results using the JSON schema in 'output_schema'."
                    ],
                    "user_request": "${args.task}",
                    "output_requirements": [
                        "Format the output for machine readability.",
                        "Provide the response as a complete, minified JSON object.",
                        "Strictly adhere to the output_schema schema specified below.",
                        "Ensure the output contains no explanations, comments, or extraneous text.",
                        "Thoroughly verify the output for accuracy and schema compliance."
                    ],
                    "output_schema": {
                        "type": "json",
                        "schema": {
                        "name": "string", // Concise descriptive project name based on the USER_REQUEST"
                        "directoryName": "string", // Valid directory name for the project, using underscores for spaces"
                        "brief": "string", // Concise description (≤200 words) of the project plan and methodology"
                        }
                    }
                }`;

            // const maxRetries = 3;
            // let retryCount = 0;
            const planJson = {};
            // let errorMessage: string = "";
            this.orchestrator.sendUpdateToPanel("Executing pre-planning.");

            const preplan = await this.pipelineHandler.generatePipelinePart(pipelinePrompt);
            if(preplan && preplan.brief && preplan.name & preplan.projectDirectory) {
                logger.info("VALID PREPLAN");
            } else {
                logger.info("BORKED PREPLAN");
            }
            state.set('preplan', JSON.stringify(preplan));
            state.set('projectDirectory', preplan.projectDirectory)
            this.orchestrator.sendUpdateToPanel(`Preplan generated: Brief: ${preplan.brief} \n User Request Name: ${preplan.name} \n Project Directory Name: ${preplan.directoryName}`);

            this.orchestrator.sendUpdateToPanel("Planning file system.");
            const filesMessage: Message = { role: 'system', content: args.task };
            const files = await executeTool('plan_directory_structure', filesMessage, state, this.orchestrator, this.pipelineHandler);

            this.orchestrator.sendUpdateToPanel("Setting objectives.");
            const objectivesMessage: Message = { role: 'system', content: args.task };
            const objectives = await executeTool('create_objectives', objectivesMessage, state, this.orchestrator, this.pipelineHandler);

            this.orchestrator.sendUpdateToPanel("Creating tasks.");
            const taskMessage: Message = { role: 'system', content: args.task };
            const tasks = await executeTool('create_tasks', taskMessage, state, this.orchestrator, this.pipelineHandler);

            const parsedTasks = await this.messageTools.multiAttemptJsonParse(tasks);

            const pipeline = this.parsePipeline(JSON.stringify(planJson));


            if (pipeline) {
                this.orchestrator.sendUpdateToPanel("Pipeline created successfully.");
                logger.info('Pipeline created successfully');
                return { pipeline: pipeline };
            } else {
                logger.error('Failed to parse plan');
                throw new Error('Failed to parse plan');
            }
        } catch (error) {
            logger.error(`Error creating pipeline: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error creating pipeline: ${getErrorMessage(error)}`);
            throw error;
        }
    }


    private parsePipeline(pipelineString: string,): Pipeline {
        const parser = createParser('json');
        if (pipelineString.length > 0) {
            const parsedPipeline = parser.parse(pipelineString);
            logger.info(`Parsed pipeline: ${JSON.stringify(parsedPipeline)}`);

            return {
                name: parsedPipeline.name,
                directoryName: parsedPipeline.directoryName,
                objectives: parsedPipeline.objectives,
                toolCalls: parsedPipeline.tasks,
                state: parsedPipeline.key_concepts
            };
        } else {
            logger.error('Failed to parse pipeline');
            throw new Error('Failed to parse pipeline');
        }
    }
}

export class Chat implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Executing chat with message: ${args.message}`);
            args.message.command = 'sendMessage';
            const response = await this.orchestrator.handleMessage(args.message);
            state.set('chat', JSON.stringify(response.content));
            logger.info('Chat executed successfully');
            return { message: response };
        } catch (error) {
            logger.error(`Error calling ollama.chat: ${getErrorMessage(error)}`);
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

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Checking project folder: ${args.path}`);
            this.orchestrator.sendUpdateToPanel(`Checking project folder: ${args.path}`);
            const projectPath = path.join(args.path || os.homedir.toString());

            try {
                await fs.access(projectPath);
                logger.info(`Project folder ${args.path} already exists`);
                return { results: [`Project folder ${args.path} already exists`] };
            } catch (error) {
                await fs.mkdir(projectPath, { recursive: true });
                logger.info(`Project folder ${args.path} created successfully`);
                return { results: [`Project folder ${args.path} created successfully`] };
            }
        } catch (error) {
            logger.error(`Error handling project folder: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error handling project folder: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}

export const createTools = (orchestrator: Orchestrator, pipelineHandler: PipelineHandler): { [key: string]: Executable } => ({
    execute_command: new ExecuteCommand(orchestrator, pipelineHandler),
    list_files_top_level: new ListFilesTopLevel(orchestrator, pipelineHandler),
    list_files_recursive: new ListFilesRecursive(orchestrator, pipelineHandler),
    view_source_code_definitions_top_level: new ViewSourceCodeDefinitions(orchestrator, pipelineHandler),
    read_file: new ReadFile(orchestrator, pipelineHandler),
    write_to_file: new WriteToFile(orchestrator, pipelineHandler),
    attempt_completion: new AttemptCompletion(orchestrator, pipelineHandler),
    planner: new CreatePlanPipeline(orchestrator, pipelineHandler),
    chat: new Chat(orchestrator, pipelineHandler),
    project_folder: new EnsureProjectFolder(orchestrator, pipelineHandler),
    create_objectives: new CreateObjectives(orchestrator, pipelineHandler),
    create_tasks: new CreateTasks(orchestrator, pipelineHandler),
    plan_directory_structure: new PlanDirectoryStructure(orchestrator, pipelineHandler),
    llm_client_handler: new LlmClientCreator(orchestrator, pipelineHandler),
    web_search: new WebSearchExecutable(orchestrator, pipelineHandler),
    open_meteo_weather: new OpenMeteoWeatherExecutable(orchestrator, pipelineHandler),
});

export async function executeTool(name: string,
    args: Message,
    state: any,
    orchestrator: Orchestrator,
    pipelineHandler: PipelineHandler): Promise<any> {
    logger.info(`Executing tool: ${name}`);
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
            const result = await handler.execute(trimmedArgs, state);
            logger.info(`Tool result: ${result}`);
            return result;
        } catch (error) {
            logger.error(`Error executing tool ${name}: ${getErrorMessage(error)}`);
            throw error;
        }
    } else {
        logger.warn(`No handler found for tool ${name}, falling back to chat`);
        const executableArgs: ExecutableArgs = { message: { role: 'user', content: trimmedArgs } };
        return await toolHandlers['chat'].execute(executableArgs, state);
    }
}

export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}
