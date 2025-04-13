const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API endpoint to create a new Qwen chat
app.post('/api/qwen/new-chat', async (req, res) => {
    try {
        const { message, isWebSearchEnabled = true, isThinkingEnabled = true } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Generate message ID - use the same ID throughout the request
        const messageId = generateId();
        
        // Use a single message object definition to avoid inconsistencies
        const messageObject = {
            id: messageId,
            parentId: null,
            childrenIds: [],
            role: "user",
            content: message,
            timestamp: Math.floor(Date.now() / 1000),
            models: ["qwen2.5-coder-32b-instruct"],
            chat_type: isWebSearchEnabled ? "search" : "t2t",
            feature_config: {
                thinking_enabled: isThinkingEnabled
            }
        };

        const requestBody = {
            chat: {
                id: "",
                title: "New Chat",
                models: ["qwen2.5-coder-32b-instruct"],
                params: {},
                history: {
                    messages: {
                        [messageId]: messageObject
                    },
                    currentId: messageId,
                    currentResponseIds: [messageId]
                },
                messages: [messageObject],
                tags: [],
                timestamp: Date.now(),
                chat_type: isWebSearchEnabled ? "search" : "t2t"
            }
        };

        // Make request to Qwen API with required headers
        const response = await axios({
            method: 'POST',
            url: 'https://chat.qwen.ai/api/v1/chats/new',
            headers: {
                'accept': 'application/json',
                'accept-language': 'en-US,en-GB;q=0.9,en;q=0.8',
                'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZjMDc2OGYxLTJhNGItNDIwOS05Nzg1LTdjNTc1ODEyZGU0NiIsImV4cCI6MTc0NTczOTMyMH0.yfMRiaiaBCRzSzw-GdpoNBjzVhMMsq6RMJVx7FLhfRw',
                'content-type': 'application/json',
                'origin': 'https://chat.qwen.ai',
                'referer': 'https://chat.qwen.ai/',
                'host': 'chat.qwen.ai'
            },
            data: requestBody,
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            }
        });

        // Return the response data, particularly the chat ID
        res.json({
            success: true,
            chatId: response.data.id,
            data: response.data
        });
    } catch (error) {
        console.error('Error creating new Qwen chat:', error);
        res.status(500).json({
            error: 'Failed to create new Qwen chat',
            details: error.message
        });
    }
});

// API endpoint to stream Qwen chat completions
app.post('/api/qwen/chat-completions', async (req, res) => {
    try {
        const { message, chatId, previousMessages, isWebSearchEnabled = true, isThinkingEnabled = true } = req.body;
        
        if (!message || !chatId) {
            return res.status(400).json({ error: 'Message and chatId are required' });
        }

        // Create a unique message ID for this request
        const messageId = generateId();
        
        // Create the current message object
        const currentMessage = {
            role: "user",
            content: message,
            chat_type: isWebSearchEnabled ? "search" : "t2t",
            extra: {},
            feature_config: {
                thinking_enabled: isThinkingEnabled
            }
        };
        
        // Prepare the messages array with previous messages
        let messages = Array.isArray(previousMessages) ? [...previousMessages] : [];
        
        // Add the current message only once
        messages.push(currentMessage);

        // Prepare the request body
        const requestBody = {
            stream: true,
            incremental_output: true,
            chat_type: isWebSearchEnabled ? "search" : "t2t",
            model: "qwen2.5-coder-32b-instruct",
            messages: messages,
            session_id: generateId(),
            chat_id: chatId,
            id: messageId
        };

        // Set up the request to Qwen API
        const response = await axios({
            method: 'POST',
            url: 'https://chat.qwen.ai/api/chat/completions',
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en-GB;q=0.9,en;q=0.8',
                'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZjMDc2OGYxLTJhNGItNDIwOS05Nzg1LTdjNTc1ODEyZGU0NiIsImV4cCI6MTc0NTczOTMyMH0.yfMRiaiaBCRzSzw-GdpoNBjzVhMMsq6RMJVx7FLhfRw',
                'content-type': 'application/json',
                'origin': 'https://chat.qwen.ai',
                'referer': `https://chat.qwen.ai/c/${chatId}`,
                'host': 'chat.qwen.ai',
                'x-accel-buffering': 'no'
            },
            data: requestBody,
            responseType: 'stream',
            maxRedirects: 5,
            timeout: 60000,
            validateStatus: function (status) {
                return status >= 200 && status < 500;
            }
        });

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Process the streaming response
        response.data.on('data', (chunk) => {
            try {
                const dataStr = chunk.toString();
                
                // Forward the data as-is in the correct SSE format
                if (dataStr.trim()) {
                    res.write(dataStr + '\n\n');
                }
            } catch (err) {
                console.error('Error processing Qwen stream chunk:', err);
            }
        });

        // Handle end of stream
        response.data.on('end', () => {
            res.write('data: [DONE]\n\n');
            res.end();
        });

        // Handle errors and client disconnect
        response.data.on('error', (err) => {
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream error', details: err.message });
            } else {
                res.end();
            }
        });

        // Handle client disconnect
        req.on('close', () => {
            response.data.destroy();
        });
    } catch (error) {
        console.error('Error proxying request to Qwen chat completions:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to get response from Qwen chat completions',
                details: error.message
            });
        } else {
            res.end();
        }
    }
});

// Helper function to generate unique IDs
function generateId() {
    return Math.random().toString(36).substring(2, 15);
}

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 