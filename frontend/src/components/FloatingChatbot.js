// components/FloatingChatbot.js
import React, { useState, useEffect, useRef } from 'react';
import '../css/FloatingChatbot.css';

const FloatingChatbot = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Add welcome message when first opened
      setMessages([
        {
          type: 'bot',
          content: `Hi ${user.name}! I'm your AI financial assistant. I can help you manage transactions with natural language.`,
          suggestions: [
            'Try these commands:',
            '• "Add $500 salary income"',
            '• "Spent $50 on groceries"',
            '• "Got $100 bonus"',
            '• "Reduce rent by $200"'
          ],
          timestamp: new Date()
        }
      ]);
    }
  }, [isOpen, user, messages.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInputValue('');

    try {
      const response = await fetch(`http://localhost:5000/api/chatbot/${user.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: inputValue })
      });

      const data = await response.json();

      const botMessage = {
        type: 'bot',
        content: data.response,
        suggestions: data.suggestions,
        transaction: data.transaction,
        timestamp: new Date(),
        success: data.success
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage = {
        type: 'bot',
        content: 'Sorry, I encountered an error. Please make sure the backend server is running and try again.',
        timestamp: new Date(),
        success: false
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (text) => {
    setInputValue(text);
  };

  return (
    <div className="floating-chatbot-wrapper">
      {/* Floating Chat Button */}
      <button 
        className={`floating-chat-button ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="AI Financial Assistant"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Widget */}
      {isOpen && (
        <div className="floating-chat-widget">
          <div className="chat-header">
            <h3>🤖 AI Financial Assistant</h3>
            <button 
              className="close-chat"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`chat-message ${message.type}-message ${message.success === false ? 'error' : ''}`}>
                <div className="message-content">
                  <p>{message.content}</p>
                  
                  {message.transaction && (
                    <div className="transaction-details">
                      <strong>✅ Transaction Created:</strong>
                      <div className="transaction-info">
                        <span className="transaction-type">{message.transaction.type}</span>
                        <span className="transaction-category">{message.transaction.category}</span>
                        <span className="transaction-amount">${Math.abs(message.transaction.amount)}</span>
                      </div>
                    </div>
                  )}
                  
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="suggestions-list">
                      {message.suggestions.map((suggestion, idx) => (
                        <div key={idx} className="suggestion-item">{suggestion}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="chat-message bot-message loading">
                <div className="message-content">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="quick-actions">
            <button 
              className="quick-btn" 
              onClick={() => handleExampleClick('Add $1000 salary income')}
              disabled={isLoading}
            >
              💰 Add Salary
            </button>
            <button 
              className="quick-btn" 
              onClick={() => handleExampleClick('Spent $50 on groceries')}
              disabled={isLoading}
            >
              🛒 Grocery
            </button>
            <button 
              className="quick-btn" 
              onClick={() => handleExampleClick('Got $200 bonus')}
              disabled={isLoading}
            >
              🎉 Bonus
            </button>
          </div>

          <form className="chat-input-form" onSubmit={handleSubmit}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your command... (e.g., 'Add $500 income')"
              disabled={isLoading}
              className="chat-input"
            />
            <button type="submit" disabled={isLoading || !inputValue.trim()} className="send-btn">
              {isLoading ? '⏳' : '📤'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default FloatingChatbot;