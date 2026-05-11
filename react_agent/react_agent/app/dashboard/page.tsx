'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import HomeView from '../../components/HomeView';
import ChatInterface from '../../components/ChatInterface';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare } from 'lucide-react';

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<'home' | 'chat'>('home');
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
  const { isAuthenticated, user, token: authToken, loading } = useAuth();
  const router = useRouter();

  // Protect the route
  useEffect(() => {
    if (!isAuthenticated && !loading) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('current_session_id');
    if (savedSessionId && !currentSessionId) {
      handleSessionSelect(savedSessionId);
    }
  }, []);

  // Persist session to localStorage
  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('current_session_id', currentSessionId);
    } else {
      localStorage.removeItem('current_session_id');
    }
  }, [currentSessionId]);

  const [selectedDocs, setSelectedDocs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const handleSessionSelect = async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setActiveView('chat');
    setIsThinking(true);
    setMessages([]);

    try {
      const response = await fetch(`http://localhost:8000/sessions/${sessionId}/messages`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      setIsThinking(false);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(undefined);
    localStorage.removeItem('current_session_id');
    setMessages([]);
    setActiveView('chat');
  };

  const [allDocs, setAllDocs] = useState<any[]>([]);
  const fetchAllDocs = async () => {
    if (authToken) {
      try {
        const response = await fetch('http://localhost:8000/documents', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
          const data = await response.json();
          setAllDocs(data);
        }
      } catch (err) {
        console.error('Failed to fetch documents', err);
      }
    }
  };

  useEffect(() => {
    fetchAllDocs();
  }, [authToken]);

  useEffect(() => {
    if (activeView === 'chat') {
      fetchAllDocs();
    }
  }, [activeView]);

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={48} />
      </div>
    );
  }

  const handleSendMessage = async (e?: React.FormEvent, messageOverride?: string) => {
    e?.preventDefault();
    const userMessage = (messageOverride || inputText).trim();
    if (!userMessage || isThinking) return;

    setInputText('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsThinking(true);

    try {
      const response = await fetch('http://localhost:8000/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          question: userMessage,
          thread_id: currentSessionId
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      // Update Session ID if it's a new chat
      const returnedSessionId = response.headers.get('X-Session-ID');
      if (returnedSessionId && !currentSessionId) {
        setCurrentSessionId(returnedSessionId);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = '';
      let hasStartedStreaming = false;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulatedResponse += chunk;
          if (!hasStartedStreaming && accumulatedResponse.length > 0) {
            hasStartedStreaming = true;
            setIsThinking(false);
            setMessages((prev) => [...prev, { role: 'agent', content: accumulatedResponse }]);
          } else if (hasStartedStreaming) {
            setMessages((prev) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = { role: 'agent', content: accumulatedResponse };
              return newMessages;
            });
          }
        }
      }
    } catch (err) {
      setIsThinking(false);
      setMessages((prev) => [...prev, { role: 'agent', content: 'Error occurred.' }]);
    }
  };

  const handleSelectDocs = (docs: any[]) => {
    setSelectedDocs(docs);
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeView={activeView}
        setActiveView={setActiveView}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
      />

      <main className="flex-1 relative overflow-hidden flex flex-col">
        {activeView === 'home' ? (
          <div className="flex-1 overflow-y-auto">
            <HomeView
              onSelectDocuments={handleSelectDocs}
              onOpenChat={(docs) => {
                setSelectedDocs(docs);
                setCurrentSessionId(undefined); // Start fresh
                localStorage.removeItem('current_session_id');
                setMessages([]);
                setActiveView('chat');
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedDocs.length > 0 || currentSessionId ? (
              <ChatInterface
                messages={messages}
                inputText={inputText}
                setInputText={setInputText}
                isThinking={isThinking}
                onSendMessage={handleSendMessage}
                onClearChat={() => setMessages([])}
                mode={selectedDocs.length > 1 ? 'multi' : 'single'}
                availableDocuments={allDocs}
                onDocumentSelect={(doc) => {
                  if (!selectedDocs.find(d => d.id === doc.id)) {
                    setSelectedDocs([...selectedDocs, doc]);
                  }
                }}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center mb-6 text-accent">
                  <MessageSquare size={40} />
                </div>
                <h2 className="text-3xl font-black mb-4 tracking-tight">Ready to Chat?</h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto mb-8">
                  Go to the <strong>Documents</strong> section and select at least one file to start a conversation with the AI.
                </p>
                <button
                  onClick={() => setActiveView('home')}
                  className="bg-accent text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Select Documents
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
