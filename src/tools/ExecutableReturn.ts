import { LlmClient } from "../llmClients/llmClient";
import { Message } from "../messages/message";
import { Pipeline } from "../pipelineHandler";


export interface ExecutableReturn {
    // consolidate on Message. files and results are the same array of string
    results?: string[];
    pipeline?: Pipeline;
    message?: Message;
    llmClient?: LlmClient;
    error?: string;
}
