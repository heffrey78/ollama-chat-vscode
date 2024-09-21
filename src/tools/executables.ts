import { Orchestrator } from '../orchestrator';
import { PipelineHandler, State } from '../pipelineHandler'
import { ExecuteCommand } from './executeCommand';
import { Executable } from './executable';
import { ExecutableReturn } from "./ExecutableReturn";
import { ExecutableArgs } from "./ExecutableArgs";
import { logger } from '../logger';
import { Message } from '../messages/message';
import { LlmClientCreator } from '../llmClients';
import { OpenMeteoWeatherExecutable } from './openMeteoWeatherExecutable';
import { WebSearchExecutable } from './webSearchExecutable';
import { CreateTasks } from './pipelines/createTasks';
import { AttemptCompletion } from './attemptCompletion';
import { CreateObjectives } from './pipelines/createObjectives';
import { CreatePlanPipeline } from './pipelines/createPlanPipeline';
import { PlanDirectoryStructure } from './pipelines/planDirectoryStructure';
import { EnsureProjectFolder } from './pipelines/ensureProjectFolder';
import { Chat } from './chat';
import { ReadFile } from './readFile';
import { ViewSourceCodeDefinitions } from './viewSourceCodeDefinitions';
import { WriteToFile } from './writeToFile';
import { ListFilesRecursive } from './listFilesRecursive';
import { ListFilesTopLevel } from './listFilesTopLevel';

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
    state: State,
    orchestrator: Orchestrator,
    pipelineHandler: PipelineHandler): Promise<ExecutableReturn> {
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
