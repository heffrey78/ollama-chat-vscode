import * as os from "os";
import * as fs from 'fs/promises';
import path from "path";
import { logger } from "../../logger";
import { Orchestrator } from "../../orchestrator";
import { PipelineHandler, State } from "../../pipelineHandler";
import { Executable } from "../executable";
import { ExecutableReturn } from "../ExecutableReturn";
import { ExecutableArgs } from "../ExecutableArgs";
import { getErrorMessage } from "../executables";

export class EnsureProjectFolder implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Checking project folder: ${args.path}`);
            this.orchestrator.sendUpdateToPanel(`Checking project folder: ${args.path}`);
            const projectPath = path.join(args.path || os.homedir.toString());
            state.set('projectDirectory', projectPath);

            try {
                await fs.access(projectPath);
                logger.info(`Project folder ${args.path} already exists`);
                return { results: [`Project folder ${args.path} already exists`] };
            } catch (error) {
                await fs.mkdir(projectPath, { recursive: true });
                logger.info(`Project folder ${args.path} created successfully`);
                return { results: [`Project folder ${args.path} created successfully`] };
            }
        } catch (error) {
            logger.error(`Error handling project folder: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error handling project folder: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}