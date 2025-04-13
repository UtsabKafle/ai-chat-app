document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const chatHistory = document.getElementById('chat-history');
    const toggleHistoryBtn = document.getElementById('toggle-history');
    const chatHistoryContainer = document.querySelector('.chat-history-container');
    const modelSelect = document.getElementById('model-select');
    
    // Generate a unique chat ID
    const currentChatId = Math.random().toString(36).substring(2, 8);
    
    // Store previous messages
    let previousMessages = [];
    
    // Set default model
    modelSelect.value = 'qwen2.5-coder-32b-instruct';
    
    // Toggle chat history visibility
    let isHistoryVisible = false;
    toggleHistoryBtn.addEventListener('click', () => {
        isHistoryVisible = !isHistoryVisible;
        chatHistoryContainer.style.display = isHistoryVisible ? 'block' : 'none';
        toggleHistoryBtn.textContent = isHistoryVisible ? 'Hide History' : 'Show History';
    });
    
    // Load chat history from localStorage
    function loadChatHistory() {
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        chatHistory.innerHTML = '';
        
        history.forEach((chat, index) => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-history-item';
            chatItem.innerHTML = `
                <div class="chat-history-header">
                    <span>Chat ${index + 1}</span>
                    <button onclick="loadChat(${index})">Load</button>
                    <button onclick="deleteChat(${index})">Delete</button>
                </div>
                <div class="chat-history-preview">${chat.messages[0]?.content?.substring(0, 50) || 'Empty chat'}...</div>
            `;
            chatHistory.appendChild(chatItem);
        });
    }
    
    // Load a specific chat
    window.loadChat = function(index) {
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        if (history[index]) {
            chatMessages.innerHTML = '';
            history[index].messages.forEach(msg => {
                if (msg.role === 'user') {
                    addMessage(msg.content, true);
                } else {
                    addMessage(msg, false);
                }
            });
            previousMessages = history[index].messages;
        }
    };
    
    // Delete a specific chat
    window.deleteChat = function(index) {
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        history.splice(index, 1);
        localStorage.setItem('chatHistory', JSON.stringify(history));
        loadChatHistory();
    };
    
    // Save chat to history
    function saveChat() {
        const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
        history.push({
            id: currentChatId,
            timestamp: new Date().toISOString(),
            messages: previousMessages
        });
        localStorage.setItem('chatHistory', JSON.stringify(history));
        loadChatHistory();
    }
    
    // Auto-resize textarea
    function adjustTextareaHeight() {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
    }
    
    userInput.addEventListener('input', adjustTextareaHeight);
    
    // Function to add a message to the chat
    function addMessage(content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        
        if (!isUser) {
            const mainContent = document.createElement('div');
            mainContent.className = 'main-content';
            mainContent.textContent = content.mainResponse || '';
            messageDiv.appendChild(mainContent);

            if (content.thinking) {
                const thinkingContent = document.createElement('div');
                thinkingContent.className = 'thinking-content';
                thinkingContent.textContent = content.thinking;
                messageDiv.appendChild(thinkingContent);
            }
        } else {
            messageDiv.textContent = content;
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to show typing indicator
    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message ai-message typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return indicator;
    }
    
    // Function to remove typing indicator
    function removeTypingIndicator(indicator) {
        indicator.remove();
    }
    
    // Function to send message
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;
        
        // Add user message to chat
        addMessage(message, true);
        userInput.value = '';
        adjustTextareaHeight(); // Reset textarea height
        
        // Show typing indicator
        const typingIndicator = showTypingIndicator();
        
        try {
            const response = await fetch('/api/qwen/chat-completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    chatId: currentChatId,
                    previousMessages,
                    isWebSearchEnabled: true,
                    isThinkingEnabled: true,
                    model: modelSelect.value
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponse = { mainResponse: '', thinking: '' };
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            break;
                        }
                        
                        try {
                            const parsedData = JSON.parse(data);
                            if (parsedData.mainResponse) {
                                aiResponse.mainResponse += parsedData.mainResponse;
                            }
                            if (parsedData.thinking) {
                                aiResponse.thinking = parsedData.thinking;
                            }
                        } catch (e) {
                            console.error('Error parsing response:', e);
                        }
                    }
                }
            }
            
            // Remove typing indicator and add AI response
            removeTypingIndicator(typingIndicator);
            addMessage(aiResponse);
            
            // Update previous messages
            previousMessages.push(
                { role: 'user', content: message },
                { role: 'assistant', content: aiResponse }
            );
            
            // Save chat to history
            saveChat();
            
        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator(typingIndicator);
            addMessage('Sorry, there was an error processing your request.', false);
        }
    }
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Load chat history on page load
    loadChatHistory();
}); 