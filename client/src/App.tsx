import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Glean RAG Chatbot</h1>
        <p className="subtitle">Ask questions about your indexed knowledge base</p>
      </header>
      <main className="app-main">
        <ChatInterface />
      </main>
    </div>
  );
}

export default App;
