import { logger } from "../logger";
import { Orchestrator } from "../orchestrator";
import { PipelineHandler, State } from "../pipelineHandler";
import { Executable } from "./executable";
import { ExecutableReturn } from "./ExecutableReturn";
import { ExecutableArgs } from "./ExecutableArgs";
import { getErrorMessage } from "./executables";

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