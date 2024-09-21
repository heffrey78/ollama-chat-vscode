import { Orchestrator } from "../orchestrator";
import { PipelineHandler, State } from "../pipelineHandler";
import { ExecutableArgs } from "./ExecutableArgs";
import { ExecutableReturn } from "./ExecutableReturn";

export interface Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;
    execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn>;
}
