import React, { useEffect, useRef, useState } from 'react';
import Header         from './components/Header';
import ChatMessage    from './components/ChatMessage';
import ChatInput      from './components/ChatInput';
import LoadingMessage from './components/LoadingMessage';
import EmptyState     from './components/EmptyState';
import SettingsPanel  from './components/SettingsPanel';
import { useQueryChat } from './hooks/useQueryChat';
import './App.css';

export default function App() {
  const {
    messages, input, setInput,
    isLoading, apiKey, setApiKey,
    sendQuestion, cancelRequest, clearChat,
  } = useQueryChat();

  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="app-root">
      <Header
        onClearChat={clearChat}
        onSettings={() => setShowSettings(true)}
        msgCount={messages.length}
      />
      <main className="chat-main">
        <div className="chat-scroll">
          {messages.length === 0 && !isLoading
            ? <EmptyState onSend={sendQuestion} />
            : (
              <div className="messages-list">
                {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
                {isLoading && <LoadingMessage />}
                <div ref={bottomRef} />
              </div>
            )
          }
        </div>
        <ChatInput
          input={input} setInput={setInput}
          onSend={sendQuestion} isLoading={isLoading}
          onCancel={cancelRequest}
        />
      </main>
      {showSettings && (
        <SettingsPanel
          apiKey={apiKey} setApiKey={setApiKey}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}