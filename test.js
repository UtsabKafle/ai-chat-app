const axios = require('axios');

async function testAPI() {
    try {
        const response = await axios.post('http://localhost:3000/api/qwen/chat-completions', {
            message: 'Hello',
            chatId: 'test123',
            isWebSearchEnabled: true,
            isThinkingEnabled: true
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testAPI(); 