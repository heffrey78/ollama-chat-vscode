import * as os from 'os';
import * as child_process from 'child_process';
import { promisify } from 'util';
import vscode from 'vscode';
import { Orchestrator } from '../orchestrator';
import { Executable, ExecutableArgs, ExecutableReturn } from './executable';
import { State, PipelineHandler } from '../pipelineHandler';

export class ExecuteCommand implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }


    async execute(args: ExecutableArgs, state: State): Promise<ExecutableReturn> {
        const permissionQuestion = `Do you want to execute the following command on ${os.platform()}?\n${args.command}\n\nReply with 'YES' to proceed.`;
        let permissionResult: any = {};
        if(!args.command) {
            throw new Error(`Executable command missing`);
        }

        // Get the user's answer using a modal dialog
        permissionResult = await vscode.window.showInputBox({
            prompt: permissionQuestion,
            placeHolder: 'Type your answer here',
            ignoreFocusOut: true
        });

        this.orchestrator.sendUpdateToPanel(`Permission question: ${permissionQuestion}, User answer: ${permissionResult}`);

        if (permissionResult?.toUpperCase() === 'YES') {
            this.orchestrator.sendUpdateToPanel(`Executing command: ${args.command}`);

            try {
                const execPromise = promisify(child_process.exec);
                const { stdout, stderr } = await execPromise(args.command);

                if (stdout) {
                    this.orchestrator.sendUpdateToPanel(`Command output: ${stdout}`);
                }
                if (stderr) {
                    this.orchestrator.sendUpdateToPanel(`Command error: ${stderr}`);
                }

                return { results: [stdout], error: stderr };

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.orchestrator.sendErrorToPanel(`Error executing command: ${errorMessage}`);
                throw error;
            }
        } else {
            return { results: ['Command execution cancelled by user.'] };
        }
    }
}
