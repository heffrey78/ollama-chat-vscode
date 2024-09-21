import { logger } from "../logger";
import { Orchestrator } from "../orchestrator";
import { PipelineHandler, State } from "../pipelineHandler";
import { Executable } from "./executable";
import { ExecutableReturn } from "./ExecutableReturn";
import { ExecutableArgs } from "./ExecutableArgs";
import { getErrorMessage } from "./executables";
import { OpenMeteoWeather } from "./openMeteoWeather";



export class OpenMeteoWeatherExecutable implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;
    private openMeteoWeather: OpenMeteoWeather;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
        this.openMeteoWeather = new OpenMeteoWeather();
    }

    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        try {
            logger.info(`Executing OpenMeteoWeather with args: ${JSON.stringify(args)}`);
            this.orchestrator.sendUpdateToPanel(`Fetching weather data...`);
            if (args.properties) {
                if (args.properties.has('latitude') && args.properties.has('longitude')) {
                    const result = await this.openMeteoWeather.execute(args.properties.get('latitude') || '', args.properties.get('longitude') || '');
                    state.set('weather', result);
                    logger.info('OpenMeteoWeather executed successfully');
                    return { results: [result] };
                }
            }
            return { results: [] };
        } catch (error) {
            logger.error(`Error executing OpenMeteoWeather: ${getErrorMessage(error)}`);
            this.orchestrator.sendErrorToPanel(`Error executing OpenMeteoWeather: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}
