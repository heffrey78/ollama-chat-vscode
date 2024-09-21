import * as os from "os";
import { logger } from "../../logger";
import { Orchestrator } from "../../orchestrator";
import { PipelineHandler, State } from "../../pipelineHandler";
import { Executable } from "../executable";
import { ExecutableReturn } from "../ExecutableReturn";
import { ExecutableArgs } from "../ExecutableArgs";
import { getErrorMessage } from "../executables";

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
                "instructions": "Analyze the 'user_request' and 'objectives'. Create a file structure for that will meet the needs of the request.",
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
                  "Double check that best practices are followed in the construction of the file system",
                  "Output must be formatted for machine reading",
                  "Provide only complete JSON that matches the schema provided, no explanations or comments"
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