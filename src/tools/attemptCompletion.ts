import * as vscode from "vscode";
import { logger } from "../logger";
import { Orchestrator } from "../orchestrator";
import { PipelineHandler, State } from "../pipelineHandler";
import { Executable } from "./executable";
import { ExecutableReturn } from "./ExecutableReturn";
import { ExecutableArgs } from "./ExecutableArgs";
import { getErrorMessage } from "./executables";

// args.task = task.name
// args.command = command to execute
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