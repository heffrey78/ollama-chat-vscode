"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleToolCall = exports.toolHandlers = exports.ChatHandler = exports.PlannerHandler = exports.AttemptCompletionHandler = exports.AskFollowupQuestionHandler = exports.WriteToFileHandler = exports.ReadFileHandler = exports.ViewSourceCodeDefinitionsHandler = exports.ListFilesRecursiveHandler = exports.ListFilesTopLevelHandler = exports.ExecuteCommandHandler = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const ollama_1 = __importDefault(require("ollama"));
const os = __importStar(require("os"));
const child_process = __importStar(require("child_process"));
class ExecuteCommandHandler {
    async execute(args, cwd, state) {
        const operatingSystem = os.platform();
        const askFollowupHandler = new AskFollowupQuestionHandler();
        const permissionQuestion = `Do you want to execute the following command on ${operatingSystem}?\n${args.command}\n\nReply with 'YES' to proceed.`;
        const permissionResult = await askFollowupHandler.execute({ question: permissionQuestion }, cwd, state);
        if (permissionResult.answer?.toUpperCase() === 'YES') {
            return new Promise((resolve, reject) => {
                child_process.exec(args.command, { cwd }, (error, stdout, stderr) => {
                    if (error) {
                        reject(`Error executing command: ${error.message}`);
                    }
                    else {
                        resolve({ result: stdout, error: stderr });
                    }
                });
            });
        }
        else {
            return { result: 'Command execution cancelled by user.' };
        }
    }
}
exports.ExecuteCommandHandler = ExecuteCommandHandler;
class ListFilesTopLevelHandler {
    async execute(args, cwd, state) {
        const dirPath = path.join(cwd, args.path);
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        return { files: files.map(file => file.name) };
    }
}
exports.ListFilesTopLevelHandler = ListFilesTopLevelHandler;
class ListFilesRecursiveHandler {
    async execute(args, cwd, state) {
        const dirPath = path.join(cwd, args.path);
        const files = await this.recursiveReadDir(dirPath);
        return { files };
    }
    async recursiveReadDir(dir) {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? this.recursiveReadDir(res) : res;
        }));
        return Array.prototype.concat(...files);
    }
}
exports.ListFilesRecursiveHandler = ListFilesRecursiveHandler;
class ViewSourceCodeDefinitionsHandler {
    async execute(args, cwd, state) {
        // Implement source code parsing logic
        return { definitions: [`class MyClass`, `function myFunction()`] };
    }
}
exports.ViewSourceCodeDefinitionsHandler = ViewSourceCodeDefinitionsHandler;
class ReadFileHandler {
    async execute(args, cwd, state) {
        const filePath = path.join(cwd, args.path);
        const content = await fs.readFile(filePath, 'utf-8');
        return { content };
    }
}
exports.ReadFileHandler = ReadFileHandler;
class WriteToFileHandler {
    async execute(args, cwd, state) {
        const filePath = path.join(cwd, args.path);
        await fs.writeFile(filePath, args.content, 'utf-8');
        return { status: `File ${filePath} written successfully` };
    }
}
exports.WriteToFileHandler = WriteToFileHandler;
class AskFollowupQuestionHandler {
    async execute(args, cwd, state) {
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
exports.AskFollowupQuestionHandler = AskFollowupQuestionHandler;
class AttemptCompletionHandler {
    async execute(args, cwd, state) {
        vscode.window.showInformationMessage(args.result);
        if (args.command) {
            // Execute the command if provided
            // Implement command execution logic here
        }
        return { status: 'Completion attempted' };
    }
}
exports.AttemptCompletionHandler = AttemptCompletionHandler;
class PlannerHandler {
    async execute(args, cwd, state) {
        // Implement planning logic
        return { plan: [`Step 1: ...`, `Step 2: ...`, `Step 3: ...`] };
    }
}
exports.PlannerHandler = PlannerHandler;
class ChatHandler {
    async execute(args, cwd, state) {
        try {
            const response = await ollama_1.default.chat(args.message);
            return { response: response };
        }
        catch (error) {
            console.error('Error calling ollama.chat:', error);
            return { error: 'Failed to get response from chat model' };
        }
    }
}
exports.ChatHandler = ChatHandler;
exports.toolHandlers = {
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
async function handleToolCall(name, args, cwd, state) {
    const handler = exports.toolHandlers[name];
    if (handler) {
        return await handler.execute(args, cwd, state);
    }
    else {
        // If no specific tool is found, use the default chatHandler
        console.log(`No specific tool found for ${name}. Using default chatHandler.`);
        return await exports.toolHandlers['chat'].execute({ message: `${name}: ${JSON.stringify(args)}` }, cwd, state);
    }
}
exports.handleToolCall = handleToolCall;
//# sourceMappingURL=toolHandlers.js.map