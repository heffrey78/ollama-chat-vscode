
export interface Message {
    role: string;
    content: string;
    tool_calls?: ToolCall[];
}
