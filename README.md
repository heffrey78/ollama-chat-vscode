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
- Send messages and receive responses within VSCode
- Simple and intuitive chat interface

## Requirements

- Ollama must be installed and running on your local machine
- The Ollama API should be accessible at `http://localhost:11434`

## How to Use

1. Install the extension
2. Make sure Ollama is running on your machine
3. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P)
4. Type "Start Ollama Chat" and select the command
5. A new webview will open with the chat interface
6. Start chatting with the AI assistant about your software engineering tasks!

## AI Assistant Capabilities

The AI assistant is designed to:

- Break down complex problems into manageable chunks
- Think logically and methodically about software development tasks
- Ask clarifying questions when there are missing pieces of information
- Provide intuitive insights about software design and architecture
- Utilize a range of tool-calling capabilities to assist with various tasks
- Offer best practices and design patterns when relevant

When no clear coding task or tool use can be determined, the assistant will engage in a helpful chat to clarify your requirements or provide general software engineering advice.

## Known Issues

- Currently only supports the models available in your local Ollama installation
- Error handling is minimal

## Release Notes

### 0.1.0

- Added AI assistant with focus on software engineering tasks
- Implemented system message to guide AI behavior
- Expanded tool-calling capabilities

### 0.0.1

Initial release of Ollama Chat VSCode Extension