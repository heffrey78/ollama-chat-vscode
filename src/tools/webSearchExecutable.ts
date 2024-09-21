import { logger } from "../logger";
import { Orchestrator } from "../orchestrator";
import { PipelineHandler, State } from "../pipelineHandler";
import { Executable } from "./executable";
import { ExecutableReturn } from "./ExecutableReturn";
import { ExecutableArgs } from "./ExecutableArgs";
import { getErrorMessage } from "./executables";
import { WebSearch } from "./webSearch";



export class WebSearchExecutable implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;
    webSearch: WebSearch;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
        this.webSearch = new WebSearch();
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Executing web search with query: ${args.query}`);
            this.orchestrator.sendUpdateToPanel(`Executing web search: ${args.query}`);
            const results = await this.webSearch.search(args.query || "", args.provider);
            logger.info('Web search executed successfully');
            const resultStrings: string[] = [];
            results.forEach(x => resultStrings.push(x.url));
            state.set(args.query || "", resultStrings.toString());
            return { results: resultStrings };
        } catch (error) {
            logger.error(`Error executing web search: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error executing web search: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}
