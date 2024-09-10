export interface ProviderConfig {
  name: string;
  url: string;
  apiType: 'Ollama' | 'OpenAI' | 'Claude';
  capabilities: ('text' | 'tool' | 'image' | 'embedding')[];
  defaultModel: string;
  apiKey?: string;
  modelsEndpoint?: string;
  chatEndpoint?: string;
  completionEndpoint?: string;
  embeddingEndpoint?: string;
  imageEndpoint?: string;
}