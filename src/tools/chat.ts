import { logger } from "../logger";
import { Orchestrator } from "../orchestrator";
import { PipelineHandler, State } from "../pipelineHandler";
import { Executable } from "./executable";
import { ExecutableReturn } from "./ExecutableReturn";
import { ExecutableArgs } from "./ExecutableArgs";
import { getErrorMessage } from "./executables";

export class Chat implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Executing chat with message: ${args.message.content}`);
            args.message.command = 'sendMessage';
            const response = await this.orchestrator.handleMessage(args.message);
            state.set('chat', JSON.stringify(response.content));
            logger.info('Chat executed successfully');
            return { message: response };
        } catch (error) {
            logger.error(`Error calling ollama.chat: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error calling ollama.chat: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}