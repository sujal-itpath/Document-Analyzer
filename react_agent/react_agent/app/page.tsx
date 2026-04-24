'use client';

import React, { useState, useEffect } from 'react';
import { Upload, FileText, Bot, Loader2, CheckCircle2, AlertCircle, RefreshCcw } from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import DocumentPreview from '../components/DocumentPreview';

export default function Home() {
  const [isUploaded, setIsUploaded] = useState(false);
  const [file, setFile] = useState<{ name: string; previewUrl: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [showPreview, setShowPreview] = useState(true);

  // Initialize session on mount
  useEffect(() => {
    const savedSessionId = localStorage.getItem('last_session_id');
    if (savedSessionId) {
      setSessionId(savedSessionId);
    } else {
      const newSessionId = `session_${Math.random().toString(36).substring(2, 11)}`;
      setSessionId(newSessionId);
      localStorage.setItem('last_session_id', newSessionId);
    }
    
    // Always start on the home/upload screen for a clean experience
    setIsUploaded(false);
    setMessages([]);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      const data = await response.json();
      setIsUploaded(true);
      setFile({ name: selectedFile.name, previewUrl: data.preview_url });
      setMessages([{ role: 'agent', content: `Hello! I've successfully analyzed **${selectedFile.name}**. \n\nYou can now ask me questions or request a summary of the content. How can I assist you?` }]);
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isThinking) return;

    const userMessage = inputText.trim();
    setInputText('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsThinking(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userMessage,
          thread_id: sessionId 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from agent');
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
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setIsThinking(false);
      setMessages((prev) => [...prev, { role: 'agent', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const startNewChat = () => {
    const newSessionId = `session_${Math.random().toString(36).substring(2, 11)}`;
    setSessionId(newSessionId);
    localStorage.setItem('last_session_id', newSessionId);
    setIsUploaded(false);
    setFile(null);
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 glass z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Bot size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight">DocuMind AI</h1>
                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Enterprise Intelligence</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isUploaded && (
              <>
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 rounded-full border border-white/10">
                  <FileText size={12} className="text-blue-400" />
                  <span className="text-[10px] font-semibold text-zinc-400 truncate max-w-[120px]">{file?.name}</span>
                  <CheckCircle2 size={10} className="text-emerald-500" />
                </div>
                <button 
                  onClick={() => setShowPreview(!showPreview)}
                  className={`p-2 rounded-lg transition-all ${showPreview ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-500 hover:text-white'}`}
                  title="Toggle Preview"
                >
                  <FileText size={18} />
                </button>
              </>
            )}
            <button 
              onClick={startNewChat}
              className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-all group"
              title="New Chat"
            >
              <RefreshCcw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          {!isUploaded ? (
            /* Upload Stage */
            <div className="flex-1 flex flex-col items-center justify-center relative p-8">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -z-10"></div>
              
              <div className="text-center mb-12">
                <h2 className="text-4xl md:text-5xl font-black mb-6 leading-tight tracking-tighter">
                  Chat with your <br /> 
                  <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Documents.</span>
                </h2>
                <p className="text-zinc-500 text-base max-w-md mx-auto font-medium">
                  Upload PDFs, Reports, or Notes and let our AI agent <br /> extract the insights you need instantly.
                </p>
              </div>

              <label className="relative group cursor-pointer">
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  accept=".pdf,.docx,.txt"
                  disabled={isUploading}
                />
                <div className={`
                  w-64 h-64 rounded-[40px] border border-white/10
                  transition-all duration-500 flex flex-col items-center justify-center gap-6
                  shadow-2xl shadow-black
                  ${isUploading ? 'bg-blue-600/5 border-blue-500/20' : 'bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-white/20'}
                `}>
                  {isUploading ? (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 animate-pulse"></div>
                        <Loader2 size={48} className="text-blue-500 animate-spin relative" />
                      </div>
                      <div className="text-center px-6">
                        <p className="text-base font-bold text-white mb-1">Processing...</p>
                        <p className="text-xs text-zinc-500 font-medium">Building vector embeddings</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-blue-500/10 transition-all duration-500">
                        <Upload size={28} className="text-zinc-400 group-hover:text-blue-400 transition-colors" />
                      </div>
                      <div className="text-center px-6">
                        <p className="text-sm font-bold text-white mb-1">Click to upload</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">PDF, DOCX, TXT</p>
                      </div>
                    </>
                  )}
                </div>
              </label>

              {error && (
                <div className="mt-8 flex items-center gap-3 text-red-400 bg-red-400/5 px-6 py-3 rounded-2xl border border-red-400/10 animate-in slide-in-from-top-2">
                  <AlertCircle size={18} />
                  <span className="text-sm font-semibold">{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Chat + Preview Stage */
            <div className="flex-1 flex min-w-0">
              <ChatInterface 
                messages={messages}
                inputText={inputText}
                setInputText={setInputText}
                isThinking={isThinking}
                onSendMessage={handleSendMessage}
                onClearChat={() => setMessages([])}
              />
              {showPreview && file && (
                <DocumentPreview 
                  url={file.previewUrl} 
                  filename={file.name} 
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
