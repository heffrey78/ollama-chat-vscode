import { Message } from '../messages/Message';

export interface ChatResponse {
    model: string;
    created_at: Date;
    message: Message;
    done: boolean;
    done_reason: string | null; // Add this line
    total_duration: number;
    load_duration: number;
    prompt_eval_count: number;
    prompt_eval_duration: number;
    eval_count: number;
    eval_duration: number;
}
