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