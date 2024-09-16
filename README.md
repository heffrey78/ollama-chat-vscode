# Ollama Chat VSCode Extension

This extension allows you to have an AI-powered chat with Ollama models directly in Visual Studio Code, focusing on software engineering tasks and product development.

## Features

- Start a chat session with Ollama models
- AI assistant focused on software engineering tasks, including:
  - Product development
  - Planning
  - Breaking down complex problems
  - Logical and methodical thinking
  - Intuitive software design and architecture
- Tool-calling capabilities for various development tasks
- Web search functionality using Google, Brave, or DuckDuckGo
- Send messages and receive responses within VSCode
- Simple and intuitive chat interface
- Configurable project directory for context-aware assistance

## Requirements

- Ollama must be installed and running on your local machine
- The Ollama API should be accessible at `http://localhost:11434`
- API keys for Google Custom Search and Brave Search (optional, for web search functionality)

## How to Use

1. Install the extension
2. Make sure Ollama is running on your machine
3. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P)
4. Type "Start Ollama Chat" and select the command
5. A new webview will open with the chat interface
6. Start chatting with the AI assistant about your software engineering tasks!

## Configuration

You can configure the following settings for the Ollama Chat extension:

- `ollama-chat-vscode.modelName`: The name of the Ollama model to use for chat (default: "llama3.1")
- `ollama-chat-vscode.workingDirectory`: The working directory for Ollama Chat. If empty, the user's home directory will be used.
- `ollama-chat-vscode.projectDirectory`: The project directory for Ollama Chat. Defaults to the current working directory (${workspaceFolder}).
- `ollama-chat-vscode.webSearch.googleApiKey`: The API key for Google Custom Search
- `ollama-chat-vscode.webSearch.googleCustomSearchEngineId`: The Custom Search Engine ID for Google Custom Search
- `ollama-chat-vscode.webSearch.braveApiKey`: The API key for Brave Search

To change these settings, go to File > Preferences > Settings (or Code > Preferences > Settings on macOS) and search for "Ollama Chat".

### Setting Up Web Search API Keys

To use the web search functionality, you'll need to set up API keys for Google Custom Search and/or Brave Search. Here's how to do it:

1. Google Custom Search:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Custom Search API for your project
   - Create credentials (API key) for the Custom Search API
   - Go to the [Programmable Search Engine](https://programmablesearchengine.google.com/cse/all) and create a new search engine
   - Note down your API key and Search Engine ID
   - In VSCode settings, set `ollama-chat-vscode.webSearch.googleApiKey` to your API key
   - Set `ollama-chat-vscode.webSearch.googleCustomSearchEngineId` to your Search Engine ID

2. Brave Search:
   - Go to the [Brave Search API](https://api.search.brave.com/app/dashboard) dashboard
   - Sign up or log in to your account
   - Create a new API key
   - In VSCode settings, set `ollama-chat-vscode.webSearch.braveApiKey` to your API key

Note: DuckDuckGo search does not require an API key and is available by default.

## AI Assistant Capabilities

The AI assistant is designed to:

- Break down complex problems into manageable chunks
- Think logically and methodically about software development tasks
- Ask clarifying questions when there are missing pieces of information
- Provide intuitive insights about software design and architecture
- Utilize a range of tool-calling capabilities to assist with various tasks
- Offer best practices and design patterns when relevant
- Perform web searches to gather relevant information for your queries

When no clear coding task or tool use can be determined, the assistant will engage in a helpful chat to clarify your requirements or provide general software engineering advice.

## Known Issues

- Currently only supports the models available in your local Ollama installation
- Error handling is minimal

## Release Notes

### 0.3.0

- Added web search functionality using Google, Brave, and DuckDuckGo
- Implemented configuration options for web search API keys

### 0.2.0

- Added configurable project directory for context-aware assistance
- Updated AI assistant to use project-specific context when available

### 0.1.0

- Added AI assistant with focus on software engineering tasks
- Implemented system message to guide AI behavior
- Expanded tool-calling capabilities

### 0.0.1

Initial release of Ollama Chat VSCode Extension