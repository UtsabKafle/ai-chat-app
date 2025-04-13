# AI Chat App

A simple chat application that allows users to interact with Qwen and Grok AI models.

## Features

- Chat interface with Qwen AI
- Chat interface with Grok AI
- Real-time streaming responses
- Modern and responsive UI
- Message history tracking

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository or download the source code
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

## Usage

1. Start the server:

```bash
node server.js
```

2. Open your web browser and navigate to:
```
http://localhost:3000
```

3. Select your preferred AI model from the dropdown menu
4. Type your message and press Enter or click the Send button
5. Wait for the AI's response

## API Endpoints

- `/api/qwen/chat` - Endpoint for Qwen AI chat
- `/api/grok/chat` - Endpoint for Grok AI chat

## Notes

- The application uses streaming responses for real-time interaction
- Message history is maintained during the session
- The UI includes a typing indicator while waiting for responses
- Error handling is implemented for failed requests

## License

This project is open source and available under the MIT License. 