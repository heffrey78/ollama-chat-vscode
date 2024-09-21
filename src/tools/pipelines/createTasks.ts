import * as os from "os";
import { ollamaTools } from "../../config/tools";
import { logger } from "../../logger";
import { Orchestrator } from "../../orchestrator";
import { PipelineHandler, State } from "../../pipelineHandler";
import { Executable } from "../executable";
import { ExecutableReturn } from "../ExecutableReturn";
import { ExecutableArgs } from "../ExecutableArgs";
import { getErrorMessage } from "../executables";

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
            return { message: { role: 'system', content: JSON.stringify(response) } };
        } catch (error) {
            logger.error(`Error creating tasks: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error creating tasks: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}