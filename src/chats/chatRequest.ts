import { Message } from "../messages/Message";
import { Tool } from "ollama";


export interface ChatRequest {
    model: string;
    messages: Message[];
    stream?: boolean;
    tools?: Tool[];
}
