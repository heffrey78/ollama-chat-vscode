export interface ToolCall {
  id: string;
  type: "function";
  function: {
      name: string;
      arguments: { [key: string]: any };
  };
}
