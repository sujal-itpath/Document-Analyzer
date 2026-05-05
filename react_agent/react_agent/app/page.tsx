'use client';

import React, { useState, useEffect } from 'react';
import { FileText, MessageSquare, Wand2, Sparkles } from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import DocumentPreview from '../components/DocumentPreview';
import AppHeader from '../components/AppHeader';
import UploadSection from '../components/UploadSection';

type AppMode = 'upload' | 'chat';

export default function Home() {
  const [mode, setMode] = useState<AppMode>('upload');
  const [isUploaded, setIsUploaded] = useState(false);
  const [files, setFiles] = useState<{ name: string; previewUrl?: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [suggestions, setSuggestions] = useState<{ id: string; label: string; icon?: React.ReactNode }[]>([]);

  const defaultSuggestions = [
    { id: 'summary', label: 'Summarize this', icon: <FileText size={14} /> },
    { id: 'extract', label: 'Key data points', icon: <Wand2 size={14} /> },
    { id: 'qa', label: 'Generate Q&A', icon: <MessageSquare size={14} /> },
  ];
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);  

  useEffect(() => {
    const savedSessionId = localStorage.getItem('last_session_id');
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light';
    if (savedTheme) setTheme(savedTheme);
    if (savedSessionId) {
      setSessionId(savedSessionId);
    } else {
      const newSessionId = `session_${Math.random().toString(36).substring(2, 11)}`;
      setSessionId(newSessionId);
      localStorage.setItem('last_session_id', newSessionId);
    }
  }, []);

  const toggleTheme = () => { 
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    const fileList = Array.from(selectedFiles);
    fileList.forEach(file => formData.append('files', file));
    formData.append('overwrite', 'true');

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload document(s)');

      setIsUploaded(true);
      setMode('chat');
      
      const uploadedFiles = fileList.map(f => ({ 
        name: f.name, 
        previewUrl: `http://localhost:8000/preview/${encodeURIComponent(f.name)}`
      }));
      
      setFiles(uploadedFiles);
      setMessages([{ 
        role: 'agent', 
        content: fileList.length === 1 
          ? `Hello! I've analyzed **${fileList[0].name}**. How can I help you with this document?`
          : `I've successfully indexed **${fileList.length} documents**. How can I assist you today?`
      }]);

      setSuggestions(defaultSuggestions);
      if (fileList.length === 1) {
        setActivePreviewUrl(uploadedFiles[0].previewUrl);
        setShowPreview(true);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, messageOverride?: string) => {
    e?.preventDefault();
    const userMessage = (messageOverride || inputText).trim();
    if (!userMessage || isThinking) return;

    setInputText('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsThinking(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage, thread_id: sessionId }),
      });

      if (!response.ok) throw new Error('Failed to get response');

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

      // Dynamic suggestion parsing
      const suggestionMatch = accumulatedResponse.match(/Suggestions:\s*(.*)$/m);
      if (suggestionMatch) {
        const suggestionList = suggestionMatch[1].split('|').map((s, i) => ({
          id: `suggestion_${Date.now()}_${i}`,
          label: s.trim(),
          icon: <Sparkles size={14} />
        })).filter(s => s.label);
        
        if (suggestionList.length > 0) {
          setSuggestions(suggestionList);
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.role === 'agent') {
              lastMsg.content = lastMsg.content.replace(/Suggestions:\s*.*$/, '').trim();
            }
            return newMessages;
          });
        }
      } else {
        setSuggestions(defaultSuggestions);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setIsThinking(false);
      setMessages((prev) => [...prev, { role: 'agent', content: 'Sorry, I encountered an error.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const resetState = () => {
    const newSessionId = `session_${Math.random().toString(36).substring(2, 11)}`;
    setSessionId(newSessionId);
    localStorage.setItem('last_session_id', newSessionId);
    setIsUploaded(false);
    setFiles([]);
    setMessages([]);
    setError(null);
    setMode('upload');
    setShowPreview(false);
    setActivePreviewUrl(null);
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-sans selection:bg-accent/30 overflow-hidden transition-colors duration-300">
      <div className="flex-1 flex flex-col min-w-0 relative">
        <AppHeader 
          theme={theme} 
          toggleTheme={toggleTheme} 
          isUploaded={isUploaded} 
          showPreview={showPreview} 
          setShowPreview={setShowPreview} 
          resetState={resetState} 
        />

        <main className="flex-1 flex overflow-hidden relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>

          {!isUploaded ? (
            <UploadSection onFileUpload={handleFileUpload} isUploading={isUploading} error={error} />
          ) : (
            <div className="flex-1 flex min-w-0 animate-in fade-in duration-700">
              <ChatInterface 
                messages={messages}
                inputText={inputText}
                setInputText={setInputText}
                isThinking={isThinking}
                onSendMessage={(e, msg) => handleSendMessage(e, msg)}
                onClearChat={() => setMessages([])}
                mode={files.length > 1 ? 'multi' : 'single'}
                quickPrompts={suggestions}
              />
              {showPreview && activePreviewUrl && (
                <DocumentPreview 
                  url={activePreviewUrl} 
                  filename={files[0]?.name || 'Preview'} 
                  onClose={() => setShowPreview(false)}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
