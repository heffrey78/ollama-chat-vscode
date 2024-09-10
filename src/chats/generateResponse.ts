
export interface GenerateResponse {
    model: string;
    created_at: Date;
    response: string;
    done: boolean;
    done_reason: string;
    context: number[];
}
