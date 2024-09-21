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

export class ListFilesRecursive implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Listing files in: ${args.path} (recursive)`);
            this.orchestrator.sendUpdateToPanel(`Listing files in: ${args.path} (recursive)`);
            const dirPath = path.join(args.path || os.homedir.toString());
            const files = await this.recursiveReadDir(dirPath);
            state.set(dirPath, files.map(x => x).join("\n"));
            logger.info(`Successfully listed ${files.length} files recursively`);
            return { results: files };
        } catch (error) {
            logger.error(`Error listing files recursively: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error listing files recursively: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    private async recursiveReadDir(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? this.recursiveReadDir(res) : res;
        }));
        return Array.prototype.concat(...files);
    }
}