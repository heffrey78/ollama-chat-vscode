import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;
    private logFile: string;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Ollama Chat');
        this.logFile = path.join(vscode.workspace.rootPath || '', 'ollama-chat.log');
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public log(message: string, level: 'INFO' | 'WARNING' | 'ERROR' = 'INFO'): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;

        // Console logging
        console.log(logMessage);

        // VSCode output channel logging
        this.outputChannel.appendLine(logMessage);

        // File logging
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }

    public info(message: string): void {
        this.log(message, 'INFO');
    }

    public warn(message: string): void {
        this.log(message, 'WARNING');
    }

    public error(message: string): void {
        this.log(message, 'ERROR');
    }
}

export const logger = Logger.getInstance();