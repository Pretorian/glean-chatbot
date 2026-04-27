import type { Message } from '../types';
import SourcesList from './SourcesList';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-header">
        <span className="message-role">{isUser ? 'You' : 'Assistant'}</span>
        <span className="message-time">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="message-content">
        <p>{message.content}</p>
      </div>

      {!isUser && message.sources && message.sources.length > 0 && (
        <SourcesList sources={message.sources} />
      )}

      {!isUser && message.meta && (
        <div className="message-meta">
          <span className="meta-item">
            Search: {message.meta.latencyMs.searchMs}ms
          </span>
          <span className="meta-item">
            Chat: {message.meta.latencyMs.chatMs}ms
          </span>
          <span className="meta-item">
            Total: {message.meta.latencyMs.totalMs}ms
          </span>
          <span className="meta-item">
            Sources: {message.meta.retrievalCount}
          </span>
        </div>
      )}
    </div>
  );
}

export default MessageBubble;
