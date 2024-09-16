
export interface GenerateResponse {
    model: string;
    response: string;
    done_reason: string;
    context: number[];
}
