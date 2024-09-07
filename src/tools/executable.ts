import { Orchestrator } from "../orchestrator";
import { State } from "../pipelineHandler";


export interface Executable {
    orchestrator: Orchestrator;
    execute(args: any, cwd: string, state: State): Promise<any>;
}
