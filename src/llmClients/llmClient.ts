import { GenerateResponse } from '../chats/generateResponse';
import { GenerateRequest } from '../chats/generateRequest';
import { ChatResponse } from '../chats/chatResponse';
import { ChatRequest } from '../chats/chatRequest';


export interface LlmClient {
    model: string;
    models: string[];
    provider: string;
    chat(params: ChatRequest): Promise<ChatResponse | undefined>;
    generate(params: GenerateRequest): Promise<GenerateResponse | undefined>;
    setModel(model: string): Promise<void>;
    getModels(): Promise<string[]>;
    setModels(): Promise<void>;
}
