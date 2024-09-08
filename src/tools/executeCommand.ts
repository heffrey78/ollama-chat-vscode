import * as os from 'os';
import * as child_process from 'child_process';
import { promisify } from 'util';
import vscode from 'vscode';
import { Orchestrator } from '../orchestrator';
import { Executable } from './executable';
import { State, PipelineHandler } from '../pipelineHandler';

export class ExecuteCommand implements Executable {
    orchestrator: Orchestrator;
    pipelineHandler: PipelineHandler;

    constructor(orchestrator: Orchestrator, pipelineHandler: PipelineHandler) {
        this.orchestrator = orchestrator;
        this.pipelineHandler = pipelineHandler;
    }


    async execute(args: any, cwd: string, state: State): Promise<any> {
        const permissionQuestion = `Do you want to execute the following command on ${os.platform()}?\n${args.command}\n\nReply with 'YES' to proceed.`;
        let permissionResult: any = {};

        try {
            // Get the user's answer using a modal dialog
            permissionResult = await vscode.window.showInputBox({
                prompt: permissionQuestion,
                placeHolder: 'Type your answer here',
                ignoreFocusOut: true
            });

            this.orchestrator.sendUpdateToPanel(JSON.stringify({ question: permissionQuestion, permissionResult }));
        } catch (error) {
            throw error;
        }


        if (permissionResult.answer?.toUpperCase() === 'YES') {
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

                return { result: stdout, error: stderr };

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.orchestrator.sendErrorToPanel(`Error executing command: ${errorMessage}`);
                throw error;
            }
        } else {
            return { result: 'Command execution cancelled by user.' };
        }
    }
}
