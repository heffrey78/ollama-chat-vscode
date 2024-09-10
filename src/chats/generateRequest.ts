
export interface GenerateRequest {
    model: string;
    prompt: string;
    system: string;
    stream?: boolean;
    format: string;
}
