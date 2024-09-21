import { createParser } from "llm-exe";
import { Message } from "../../messages/message";
import { logger } from "../../logger";
import { MessageTools } from "../../messages/messageTools";
import { Orchestrator } from "../../orchestrator";
import { PipelineHandler, State, Pipeline } from "../../pipelineHandler";
import { Executable } from "../executable";
import { ExecutableReturn } from "../ExecutableReturn";
import { ExecutableArgs } from "../ExecutableArgs";
import { executeTool, getErrorMessage } from "../executables";

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
                        "Analyze the provided 'user_request'",
                        "Execute the tasks listed in the 'tasks' array"
                        "Only return JSON"
                    ],
                    "tasks": [
                        "Pause and reflect: Before responding, take a moment to pause and reflect on the 'user_request'.",
                        "Acknowledge the task: Mentally acknowledge that you're about to respond to a user query.",
                        "Self-prompt for careful reading: Remind yourself to carefully read the entire query again.",
                        "Re-read the query: Actually re-read the full query from start to finish.",
                        "Identify key components: Break down the query into its main components or requirements.",
                        "Summarize the request: Briefly summarize the core ask in your own words.",
                        "Check for completeness: Ensure you haven't missed any parts of the request.",
                        "Plan your response: Only after completing these steps, begin planning your response.",
                        "Execute: Proceed with crafting and delivering your response.",
                        "Create a 200 word 'brief' that gives an executive mandate describing how 'user_request' should be fulfilled",
                        "Create an appropriate project 'name'",
                        "Create an appropriate project 'directoryName'",
                        "Return JSON conforming to the schema in 'output_schema'"
                    ],
                    "user_request": "${args.task} ### Re-read the 'user_request': ${args.task}",
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

            const preplanExecutableReturn = await this.pipelineHandler.generatePipelinePart(pipelinePrompt);
            const preplanObject = preplanExecutableReturn.message ? JSON.parse(preplanExecutableReturn.message.content) : '';
            if(preplanObject && preplanObject.brief && preplanObject.name & preplanObject.projectDirectory) {
                logger.info("VALID PREPLAN");
            } else {
                logger.info("BORKED PREPLAN");
            }
            state.set('preplan', JSON.stringify(preplanExecutableReturn));
            state.set('projectDirectory', preplanObject.projectDirectory)
            this.orchestrator.sendUpdateToPanel(`Preplan generated: Brief: ${preplanObject.brief} \n User Request Name: ${preplanObject.name} \n Project Directory Name: ${preplanObject.directoryName}`);

            this.orchestrator.sendUpdateToPanel("Planning file system.");
            const filesMessage: Message = { role: 'system', content: args.task };
            const files = await executeTool('plan_directory_structure', filesMessage, state, this.orchestrator, this.pipelineHandler);
            this.orchestrator.sendUpdateToPanel(`files: ${JSON.stringify(files)}`);

            this.orchestrator.sendUpdateToPanel('Setting objectives.');
            const objectivesMessage: Message = { role: 'system', content: args.task };
            const objectives = await executeTool('create_objectives', objectivesMessage, state, this.orchestrator, this.pipelineHandler);
            this.orchestrator.sendUpdateToPanel(`objectives: ${JSON.stringify(objectives)}`);

            this.orchestrator.sendUpdateToPanel('Creating tasks.');
            const taskMessage: Message = { role: 'system', content: args.task };
            const tasks = await executeTool('create_tasks', taskMessage, state, this.orchestrator, this.pipelineHandler);

            if(!tasks) throw new Error('tasks not defined');
            const parsedTasks = await this.messageTools.multiAttemptJsonParse(tasks.message?.content || '');
            this.orchestrator.sendUpdateToPanel(`parsedTasks: ${JSON.stringify(parsedTasks)}`);

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