import { Message } from "../messages/message";
import { Tool } from "ollama";


export interface ChatRequest {
    model: string;
    messages: Message[];
    stream?: boolean;
    tools?: Tool[];
}
