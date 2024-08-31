import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import ollama from 'ollama';
import * as os from 'os';
import * as child_process from 'child_process';

export interface ToolHandler {
    execute(args: any, cwd: string, state: any): Promise<any>;
}

export class ExecuteCommandHandler implements ToolHandler {
    async execute(args: any, cwd: string, state: any): Promise<any> {
        const operatingSystem = os.platform();
        const askFollowupHandler = new AskFollowupQuestionHandler();

        const permissionQuestion = `Do you want to execute the following command on ${operatingSystem}?\n${args.command}\n\nReply with 'YES' to proceed.`;
        const permissionResult = await askFollowupHandler.execute({ question: permissionQuestion }, cwd, state);

        if (permissionResult.answer?.toUpperCase() === 'YES') {
            return new Promise((resolve, reject) => {
                child_process.exec(args.command, { cwd }, (error, stdout, stderr) => {
                    if (error) {
                        reject(`Error executing command: ${error.message}`);
                    } else {
                        resolve({ result: stdout, error: stderr });
                    }
                });
            });
        } else {
            return { result: 'Command execution cancelled by user.' };
        }
    }
}

export class ListFilesTopLevelHandler implements ToolHandler {
    async execute(args: any, cwd: string, state: any): Promise<any> {
        const dirPath = path.join(cwd, args.path);
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        return { files: files.map(file => file.name) };
    }
}

export class ListFilesRecursiveHandler implements ToolHandler {
    async execute(args: any, cwd: string, state: any): Promise<any> {
        const dirPath = path.join(cwd, args.path);
        const files = await this.recursiveReadDir(dirPath);
        return { files };
    }

    private async recursiveReadDir(dir: string): Promise<string[]> {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? this.recursiveReadDir(res) : res;
        }));
        return Array.prototype.concat(...files);
    }
}

export class ViewSourceCodeDefinitionsHandler implements ToolHandler {
    async execute(args: any, cwd: string, state: any): Promise<any> {
        // Implement source code parsing logic
        return { definitions: [`class MyClass`, `function myFunction()`] };
    }
}

export class ReadFileHandler implements ToolHandler {
    async execute(args: any, cwd: string, state: any): Promise<any> {
        const filePath = path.join(cwd, args.path);
        const content = await fs.readFile(filePath, 'utf-8');
        return { content };
    }
}

export class WriteToFileHandler implements ToolHandler {
    async execute(args: any, cwd: string, state: any): Promise<any> {
        const filePath = path.join(cwd, args.path);
        await fs.writeFile(filePath, args.content, 'utf-8');
        return { status: `File ${filePath} written successfully` };
    }
}

export class AskFollowupQuestionHandler implements ToolHandler {
    async execute(args: any, cwd: string, state: any): Promise<any> {
        // Create a toast notification in the chat window
        vscode.window.showInformationMessage(args.question);
        
        // Get the user's answer using a modal dialog
        const answer = await vscode.window.showInputBox({
            prompt: args.question,
            placeHolder: 'Type your answer here',
            ignoreFocusOut: true
        });
        
        // Return both the question and the answer
        return { question: args.question, answer };
    }
}

export class AttemptCompletionHandler implements ToolHandler {
    async execute(args: any, cwd: string, state: any): Promise<any> {
        vscode.window.showInformationMessage(args.result);
        if (args.command) {
            // Execute the command if provided
            // Implement command execution logic here
        }
        return { status: 'Completion attempted' };
    }
}

export class PlannerHandler implements ToolHandler {
    async execute(args: any, cwd: string, state: any): Promise<any> {
        // Implement planning logic
        return { plan: [`Step 1: ...`, `Step 2: ...`, `Step 3: ...`] };
    }
}

export class ChatHandler implements ToolHandler {
    async execute(args: any, cwd: string, state: any): Promise<any> {
        try {
            const response = await ollama.chat(args.message);
            return { response: response };
        } catch (error) {
            console.error('Error calling ollama.chat:', error);
            return { error: 'Failed to get response from chat model' };
        }
    }
}

export const toolHandlers: { [key: string]: ToolHandler } = {
    execute_command: new ExecuteCommandHandler(),
    list_files_top_level: new ListFilesTopLevelHandler(),
    list_files_recursive: new ListFilesRecursiveHandler(),
    view_source_code_definitions_top_level: new ViewSourceCodeDefinitionsHandler(),
    read_file: new ReadFileHandler(),
    write_to_file: new WriteToFileHandler(),
    ask_followup_question: new AskFollowupQuestionHandler(),
    attempt_completion: new AttemptCompletionHandler(),
    planner: new PlannerHandler(),
    chat: new ChatHandler(),
};

export async function handleToolCall(name: string, args: any, cwd: string, state: any): Promise<any> {
    const handler = toolHandlers[name];
    if (handler) {
        return await handler.execute(args, cwd, state);
    } else {
        // If no specific tool is found, use the default chatHandler
        console.log(`No specific tool found for ${name}. Using default chatHandler.`);
        return await toolHandlers['chat'].execute({ message: `${name}: ${JSON.stringify(args)}` }, cwd, state);
    }
}