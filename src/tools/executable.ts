import { Orchestrator } from "../orchestrator";
import { PipelineHandler, State } from "../pipelineHandler";


export interface Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;
    execute(args: any, state: State): Promise<any>;
}
