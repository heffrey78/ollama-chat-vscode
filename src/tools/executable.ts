import { Orchestrator } from "../orchestrator";
import { PipelineHandler, State } from "../pipelineHandler";


export interface Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;
    execute(args: any, cwd: string, state: State): Promise<any>;
}
