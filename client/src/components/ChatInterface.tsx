import { useState, useRef, useEffect } from 'react';
import { askQuestion } from '../api';
import type { Message } from '../types';
import MessageList from './MessageList';
import QuestionInput from './QuestionInput';
import './ChatInterface.css';

function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendQuestion = async (question: string) => {
    if (!question.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await askQuestion(question);

      // Add assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        meta: response.meta,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer');

      // Add error message
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get answer'}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.length === 0 && (
          <div className="empty-state">
            <h2>Welcome to Glean RAG Chatbot</h2>
            <p>Ask a question about your indexed knowledge base to get started.</p>
            <div className="example-questions">
              <p className="example-label">Try asking:</p>
              <button
                className="example-question"
                onClick={() => handleSendQuestion("What is our remote work policy?")}
              >
                What is our remote work policy?
              </button>
            </div>
          </div>
        )}

        <MessageList messages={messages} />
        <div ref={messagesEndRef} />
      </div>

      <QuestionInput
        onSend={handleSendQuestion}
        isLoading={isLoading}
        disabled={isLoading}
      />
    </div>
  );
}

export default ChatInterface;
