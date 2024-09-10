import * as fs from 'fs';
import * as path from 'path';
import { ProviderConfig } from './providerConfig';

function validateProviderConfig(config: any): config is ProviderConfig {
  return (
    typeof config.name === 'string' &&
    typeof config.url === 'string' &&
    ['Ollama', 'OpenAI', 'Claude'].includes(config.apiType) &&
    Array.isArray(config.capabilities) &&
    typeof config.defaultModel === 'string'
  );
}

export function loadProviderConfig(filePath: string): ProviderConfig {
  const jsonConfig = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (validateProviderConfig(jsonConfig)) {
    return jsonConfig;
  } else {
    throw new Error(`Invalid provider configuration in file: ${filePath}`);
  }
}

export async function loadAllProviderConfigs(providersDir: string): Promise<ProviderConfig[]> {
  const configs: ProviderConfig[] = [];
  const files = await fs.promises.readdir(providersDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(providersDir, file);
      try {
        const config = loadProviderConfig(filePath);
        configs.push(config);
      } catch (error) {
        console.error(`Error loading config from ${file}:`, error);
      }
    }
  }
  return configs;
}
