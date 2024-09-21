import * as os from "os";
import { ollamaTools } from "../../config/tools";
import { logger } from "../../logger";
import { Orchestrator } from "../../orchestrator";
import { PipelineHandler, State } from "../../pipelineHandler";
import { Executable } from "../executable";
import { ExecutableReturn } from "../ExecutableReturn";
import { ExecutableArgs } from "../ExecutableArgs";
import { getErrorMessage } from "../executables";

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