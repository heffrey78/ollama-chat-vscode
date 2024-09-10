import { Message } from "../messages/message";
import { Orchestrator } from "../orchestrator";
import { Pipeline, PipelineHandler, State } from "../pipelineHandler";

export interface ExecutableArgs {
    message: Message;
    task?: string;
    command?: string;
    path?: string;
}

export interface ExecutableReturn {
    files?: string[];
    results?: string[];
    pipeline?: Pipeline;
    message?: Message;
    error?: string;
}

export interface Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;
    execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn>;
}
