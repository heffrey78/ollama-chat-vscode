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
            return { results: files.map(file => file.name) };
        } catch (error) {
            logger.error(`Error listing files: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error listing files: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}