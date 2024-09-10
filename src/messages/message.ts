
export interface Message {
    role: string;
    content: string;
    tool_calls?: ToolCall[];
    tool_use?: boolean;
    command?: string;
    model?: string;
    provider?: string;
}
