import { useState, KeyboardEvent } from 'react';
import './QuestionInput.css';

interface QuestionInputProps {
  onSend: (question: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

function QuestionInput({ onSend, isLoading, disabled }: QuestionInputProps) {
  const [question, setQuestion] = useState('');

  const handleSend = () => {
    if (question.trim() && !disabled) {
      onSend(question.trim());
      setQuestion('');
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="question-input">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Ask a question..."
        disabled={disabled}
        rows={1}
        className="question-textarea"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !question.trim()}
        className="send-button"
      >
        {isLoading ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}

export default QuestionInput;
