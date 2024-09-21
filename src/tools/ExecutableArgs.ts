import { Message } from "../messages/message";


export interface ExecutableArgs {
    message: Message;
    task?: string;
    command?: string;
    content?: string;
    path?: string;
    query?: string;
    provider?: string;
    properties?: Map<string, string>;
}
