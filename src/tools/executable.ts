import { LlmClient } from "../llmClients/llmClient";
import { Message } from "../messages/message";
import { Orchestrator } from "../orchestrator";
import { Pipeline, PipelineHandler, State } from "../pipelineHandler";

export interface ExecutableArgs {
    message: Message;
    task?: string;
    command?: string;
    path?: string;
    query?: string;
    provider?: string;
    key_value_pairs?: Map<string, string>;
}

export interface ExecutableReturn {
    // consolidate on Message. files and results are the same array of string
    files?: string[];
    results?: string[];
    pipeline?: Pipeline;
    message?: Message;
    llmClient?: LlmClient;
    error?: string;
}

export interface Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;
    execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn>;
}
