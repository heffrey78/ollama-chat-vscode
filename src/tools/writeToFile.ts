import * as os from "os";
import * as fs from 'fs/promises';
import path from "path";
import { logger } from "../logger";
import { Orchestrator } from "../orchestrator";
import { PipelineHandler, State } from "../pipelineHandler";
import { Executable } from "./executable";
import { ExecutableReturn } from "./ExecutableReturn";
import { ExecutableArgs } from "./ExecutableArgs";
import { getErrorMessage } from "./executables";

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
            state.set(filePath, args.content || args.message.content);
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