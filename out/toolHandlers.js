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
exports.createToolHandlers = exports.ChatHandler = exports.PipelineFactoryHandler = exports.AttemptCompletionHandler = exports.AskFollowupQuestionHandler = exports.WriteToFileHandler = exports.ReadFileHandler = exports.ViewSourceCodeDefinitionsHandler = exports.ListFilesRecursiveHandler = exports.ListFilesTopLevelHandler = exports.ExecuteCommandHandler = void 0;
exports.handleToolCall = handleToolCall;
exports.getErrorMessage = getErrorMessage;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const ollama_1 = __importDefault(require("ollama"));
const os = __importStar(require("os"));
const child_process = __importStar(require("child_process"));
const tools_1 = require("./config/tools");
const llm_exe_1 = require("llm-exe");
const util_1 = require("util");
class ExecuteCommandHandler {
    constructor(messageHandler) {
        this.messageHandler = messageHandler;
    }
    async execute(args, cwd, state) {
        const askFollowupHandler = new AskFollowupQuestionHandler(this.messageHandler);
        this.messageHandler.updateUser(`Executing command: ${args.command}`);
        const permissionQuestion = `Do you want to execute the following command on ${os.platform()}?\n${args.command}\n\nReply with 'YES' to proceed.`;
        const permissionResult = await askFollowupHandler.execute({ question: permissionQuestion }, cwd, state);
        if (permissionResult.answer?.toUpperCase() === 'YES') {
            try {
                const execPromise = (0, util_1.promisify)(child_process.exec);
                const { stdout, stderr } = await execPromise(args.command);
                if (stdout) {
                    this.messageHandler.updateUser(`Command output: ${stdout}`);
                }
                if (stderr) {
                    this.messageHandler.updateUser(`Command error: ${stderr}`);
                }
                return { result: stdout, error: stderr };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                this.messageHandler.handleErrorMessage(`Error executing command: ${errorMessage}`);
                throw error;
            }
        }
        else {
            return { result: 'Command execution cancelled by user.' };
        }
    }
}
exports.ExecuteCommandHandler = ExecuteCommandHandler;
class ListFilesTopLevelHandler {
    constructor(messageHandler) {
        this.messageHandler = messageHandler;
    }
    async execute(args, cwd, state) {
        try {
            this.messageHandler.updateUser(`Listing files in: ${args.path}`);
            const dirPath = path.join(cwd, args.path);
            const files = await fs.readdir(dirPath, { withFileTypes: true });
            return { files: files.map(file => file.name) };
        }
        catch (error) {
            this.messageHandler.handleErrorMessage(`Error listing files: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}
exports.ListFilesTopLevelHandler = ListFilesTopLevelHandler;
class ListFilesRecursiveHandler {
    constructor(messageHandler) {
        this.messageHandler = messageHandler;
    }
    async execute(args, cwd, state) {
        try {
            this.messageHandler.updateUser(`Listing files in: ${args.path} (recursive)`);
            const dirPath = path.join(cwd, args.path);
            const files = await this.recursiveReadDir(dirPath);
            return { files };
        }
        catch (error) {
            this.messageHandler.handleErrorMessage(`Error listing files recursively: ${getErrorMessage(error)}`);
            throw error;
        }
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
    constructor(messageHandler) {
        this.messageHandler = messageHandler;
    }
    async execute(args, cwd, state) {
        try {
            this.messageHandler.updateUser(`Viewing source code.`);
            // Implement source code parsing logic
            return { definitions: [`class MyClass`, `function myFunction()`] };
        }
        catch (error) {
            this.messageHandler.handleErrorMessage(`Error viewing source code definitions: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}
exports.ViewSourceCodeDefinitionsHandler = ViewSourceCodeDefinitionsHandler;
class ReadFileHandler {
    constructor(messageHandler) {
        this.messageHandler = messageHandler;
    }
    async execute(args, cwd, state) {
        try {
            this.messageHandler.updateUser(`Reading file: ${args.path}`);
            const filePath = path.join(cwd, args.path);
            const content = await fs.readFile(filePath, 'utf-8');
            return { content };
        }
        catch (error) {
            this.messageHandler.handleErrorMessage(`Error reading file: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}
exports.ReadFileHandler = ReadFileHandler;
class WriteToFileHandler {
    constructor(messageHandler) {
        this.messageHandler = messageHandler;
    }
    async execute(args, cwd, state) {
        try {
            this.messageHandler.updateUser(`Writing file: ${args.path}`);
            const filePath = path.join(cwd, args.path);
            await fs.writeFile(filePath, args.content, 'utf-8');
            return { status: `File ${filePath} written successfully` };
        }
        catch (error) {
            this.messageHandler.handleErrorMessage(`Error writing to file: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}
exports.WriteToFileHandler = WriteToFileHandler;
class AskFollowupQuestionHandler {
    constructor(messageHandler) {
        this.messageHandler = messageHandler;
    }
    async execute(args, cwd, state) {
        try {
            // Get the user's answer using a modal dialog
            const answer = await vscode.window.showInputBox({
                prompt: args.question,
                placeHolder: 'Type your answer here',
                ignoreFocusOut: true
            });
            this.messageHandler.updateUser(JSON.stringify({ question: args.question, answer }));
            // Return both the question and the answer
            return { question: args.question, answer };
        }
        catch (error) {
            this.messageHandler.handleErrorMessage(`Error asking follow-up question: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}
exports.AskFollowupQuestionHandler = AskFollowupQuestionHandler;
class AttemptCompletionHandler {
    constructor(messageHandler) {
        this.messageHandler = messageHandler;
    }
    async execute(args, cwd, state) {
        try {
            vscode.window.showInformationMessage(args.result);
            if (args.command) {
                this.messageHandler.updateUser(`Attempted competion`);
                // Execute the command if provided
                // Implement command execution logic here
            }
            return { status: 'Completion attempted' };
        }
        catch (error) {
            this.messageHandler.handleErrorMessage(`Error attempting completion: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}
exports.AttemptCompletionHandler = AttemptCompletionHandler;
class PipelineFactoryHandler {
    constructor(messageHandler) {
        this.pipeline = null;
        this.messageHandler = messageHandler;
    }
    async execute(args, cwd, state) {
        try {
            const pipelinePrompt = `
                # Given the following user request:
                1. Ruminate on the user request.
                2. Plan the task architecture and create an array of key concepts that should be adhered to.
                3. Create a plan by creating a list of objectives describing an minimum viable product that will fulfill the request
                4. Fulfill the objectives by breaking them down into small, individually executable tasks.
                5. Each task should be a single, atomic operation that can be performed independently as a commandline operation.

                # System Info:
                - OS: ${os.platform()}
                - Home directory: ${os.homedir()}
                - cwd: ${cwd}
                
                # Available tools: 
                ${JSON.stringify(tools_1.ollamaTools)}

                User Request: ${args.task}

                # DO: USE CONSISTENT VARIABLE AND FILE NAMING ACROSS ALL TASKS.
                # DO: CREATE TASKS USING ABSOLUTE PATHS OR RELATIVE PATHS TO CWD + directoryName
                # DO NOT: ADD NEWLINE CHARACTERS OR OTHER FORMATTING THAT CAN BREAK PARSING
                # DO NOT: EXPLAIN YOURSELF. 
                # Your response will go directly into a program, so do not add comments.
                # Return ONLY the plan as a JSON string strictly following this example:

                {
                    "name": "Project Name",
                    "directoryName": "project_directory_name",
                    "description": "A user friendly description of the project plan using markdown.",
                    "key_concepts": [
                        { 
                            "key": "keyword describing concept (e.g., 'backend_framework', etc.)", 
                            "value": "value (e.g. 'Flask', etc.)"  
                        }, ... more key concepts
                    ],
                    "objectives": [
                        {
                            "objective": "Description of the objective (e.g., 'save journal entries to database', etc.)",
                        }, ... more objectives
                    ],
                    "tasks": [
                        {
                            "task": "Description of the task",
                            "function": {
                                "name": "Name of the tool to use (e.g., 'execute_command', 'read_file', 'write_to_file', etc.)",
                                "arguments": {
                                    // Key/value pairs representing arguments specific to the tool
                                }
                            }
                        },
                        // ... more tasks
                    ]
                }
            `;
            const maxRetries = 3;
            let retryCount = 0;
            let planJson = {};
            let errorMessage = "";
            this.messageHandler.updateUser("Attempting to create plan.");
            while (retryCount < maxRetries) {
                try {
                    const failureReply = retryCount > 0 ? `Attempt #${retryCount + 1} \n Error from JSON.parse when trying to parse previous response: ${errorMessage}` : "";
                    const response = await this.messageHandler.handleToolMessage(pipelinePrompt + failureReply, false);
                    const trimmedResponse = this.tryParseJson(response);
                    planJson = trimmedResponse.json;
                    this.messageHandler.updateUser(`Plan JSON: ${JSON.stringify(planJson)}`);
                    // If we reach this point, the response is valid JSON, so break out of the loop.
                    break;
                }
                catch (error) {
                    if (error instanceof SyntaxError) {
                        errorMessage = error.message;
                    }
                    if (!(error instanceof SyntaxError)) {
                        // If the error is not due to invalid JSON, rethrow it.        
                        throw error;
                    }
                    retryCount++;
                    if (retryCount === maxRetries) {
                        throw new Error(`Failed to receive valid JSON after ${maxRetries} retries.`);
                    }
                    // Wait for a short duration before retrying to avoid overwhelming the server.
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            }
            const keywordsPrompt = `
            Given the following user request and the previously pipeline plan, identify the key file names, programming concepts, or frameworks involved in this task.

                    User Request: ${args.task}

            Plan: ${planJson}


                # # DO NOT EXPLAIN YOURSELF. 
                # # Your response will go directly into a program, so do not add comments.
                # # Return ONLY the keywords array as a JSON object following this example:
            {
                items: 
                [
                    { 
                        "key": "language", 
                        "value": "Python"  
                    },  
                    {    
                        "key": "framework",    
                        "value": "Flask"  
                    },  
                    {    
                        "key": "environmentManager",    
                        "value": "venv"  
                    },  
                    {    
                        "key": "packageManager",    
                        "value": "pip"  
                    },  
                    {    
                        "key": "controllerName", 
                        "value": "journalController"  
                    } 
                ]
            }   
          `;
            const keywordsResponse = await this.messageHandler.handleToolMessage(keywordsPrompt, false);
            const parsedKeywords = this.parseKeywords(keywordsResponse);
            this.parsePipeline(JSON.stringify(planJson), parsedKeywords);
            if (this.pipeline) {
                return this.pipeline; // Return the entire plan object
            }
            else {
                throw new Error('Failed to parse plan');
            }
        }
        catch (error) {
            this.messageHandler.handleErrorMessage(`Error creating pipeline: ${getErrorMessage(error)}`);
            throw error;
        }
    }
    tryParseJson(response) {
        let trimmedResponse = response.trim();
        const jsonRegex = /^(\{|\[])([\s\S]*?)(\}|])$/;
        if (!jsonRegex.test(trimmedResponse)) {
            // Remove non-JSON content from the beginning and end of the string
            trimmedResponse = trimmedResponse.replace(/^[^\{\[]+|[^\}\]]+$/, '');
        }
        try {
            const json = JSON.parse(trimmedResponse);
            return { success: true, json };
        }
        catch (error) {
            this.messageHandler.handleErrorMessage(`Error creating pipeline: ${getErrorMessage(error)}`);
            throw error;
        }
    }
    parseKeywords(keywordsResponse) {
        const parser = (0, llm_exe_1.createParser)('json');
        const jsonToParse = this.extractJsonFromString(keywordsResponse);
        if (jsonToParse.length > 0) {
            const parsedKeywords = parser.parse(jsonToParse[0]);
            console.log(JSON.stringify(parsedKeywords));
            if (parsedKeywords && parsedKeywords.items) {
                return new Map(parsedKeywords.items.map((item) => [item.key, item.value]));
            }
        }
        console.log('Failed to parse keywords');
        return new Map();
    }
    parsePipeline(pipelineString, state) {
        const parser = (0, llm_exe_1.createParser)('json');
        if (pipelineString.length > 0) {
            const parsedPipeline = parser.parse(pipelineString);
            console.log(JSON.stringify(parsedPipeline));
            this.pipeline = {
                name: parsedPipeline.name,
                directoryName: parsedPipeline.directoryName,
                objectives: parsedPipeline.objectives,
                tasks: parsedPipeline.tasks,
                state: state
            };
        }
        else {
            console.log('Failed to parse pipeline');
        }
    }
    getPipeline() {
        return this.pipeline;
    }
    extractJsonFromString(input) {
        const jsonRegex = /(\{[\s\S]*\}|\[[\s\S]*\])/g;
        const matches = input.match(jsonRegex);
        if (!matches) {
            return [];
        }
        return matches.filter(match => {
            try {
                JSON.parse(match);
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
}
exports.PipelineFactoryHandler = PipelineFactoryHandler;
class ChatHandler {
    constructor(messageHandler) {
        this.messageHandler = messageHandler;
    }
    async execute(args, cwd, state) {
        try {
            const response = await ollama_1.default.chat(args.message);
            return { response: response };
        }
        catch (error) {
            this.messageHandler.handleErrorMessage(`Error calling ollama.chat: ${getErrorMessage(error)}`);
            throw error;
        }
    }
}
exports.ChatHandler = ChatHandler;
const createToolHandlers = (messageHandler) => ({
    execute_command: new ExecuteCommandHandler(messageHandler),
    list_files_top_level: new ListFilesTopLevelHandler(messageHandler),
    list_files_recursive: new ListFilesRecursiveHandler(messageHandler),
    view_source_code_definitions_top_level: new ViewSourceCodeDefinitionsHandler(messageHandler),
    read_file: new ReadFileHandler(messageHandler),
    write_to_file: new WriteToFileHandler(messageHandler),
    ask_followup_question: new AskFollowupQuestionHandler(messageHandler),
    attempt_completion: new AttemptCompletionHandler(messageHandler),
    planner: new PipelineFactoryHandler(messageHandler),
    chat: new ChatHandler(messageHandler),
});
exports.createToolHandlers = createToolHandlers;
async function handleToolCall(name, args, cwd, state, messageHandler) {
    // Trim the name of special characters
    const trimmedName = name.replace(/[^\w\s-]/g, '').trim();
    const trimmedArgs = Object.entries(args).reduce((acc, [key, value]) => {
        if (typeof value === 'string') {
            // Replace newlines with spaces and trim
            acc[key] = value.replace(/\n/g, ' ').trim();
        }
        else if (typeof value === 'object' && value !== null) {
            // For objects, we'll stringify, replace newlines, then parse back
            acc[key] = JSON.parse(JSON.stringify(value).replace(/\n/g, ' '));
        }
        else {
            acc[key] = value;
        }
        return acc;
    }, {});
    const toolHandlers = (0, exports.createToolHandlers)(messageHandler);
    const handler = toolHandlers[trimmedName];
    if (handler) {
        try {
            return await handler.execute(trimmedArgs, cwd, state);
        }
        catch (error) {
            throw error;
        }
    }
    else {
        return await toolHandlers['chat'].execute({ message: `${trimmedName}: ${JSON.stringify(trimmedArgs)}` }, cwd, state);
    }
}
function getErrorMessage(error) {
    if (error instanceof Error)
        return error.message;
    return String(error);
}
//# sourceMappingURL=toolHandlers.js.map