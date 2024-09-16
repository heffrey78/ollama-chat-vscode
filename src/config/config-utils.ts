import * as vscode from 'vscode';
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

export async function updateWorkspaceConfig(workpsaceConfiguration: vscode.WorkspaceConfiguration, key: string, value: any): Promise<void> {
  // Check if a workspace is open
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    // Workspace is open, update workspace configuration
    await workpsaceConfiguration.update(key, value, vscode.ConfigurationTarget.Workspace);
  } else {
    // No workspace open, update global configuration
    await vscode.workspace.getConfiguration().update(`ollama-chat-vscode.${key}`, value, vscode.ConfigurationTarget.Global);
  }
}

