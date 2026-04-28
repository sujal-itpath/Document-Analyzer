'use client';

import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, Bot, Loader2, CheckCircle2, 
  AlertCircle, RefreshCcw, Files, LayoutGrid, 
  ChevronRight, MessageSquare, ArrowLeft, Plus
} from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import DocumentPreview from '../components/DocumentPreview';

type AppMode = 'selection' | 'single' | 'multi';

export default function Home() {
  const [mode, setMode] = useState<AppMode>('selection');
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
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    const fileList = Array.from(selectedFiles);
    
    fileList.forEach(file => {
      formData.append('files', file);
    });
    
    // Always overwrite for a new session start
    formData.append('overwrite', 'true');

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload document(s)');
      }

      const data = await response.json();
      setIsUploaded(true);
      
      const uploadedFiles = fileList.map(f => ({ 
        name: f.name, 
        previewUrl: `http://localhost:8000/preview/${encodeURIComponent(f.name)}`
      }));
      
      setFiles(uploadedFiles);
      
      if (mode === 'single') {
        setMessages([{ 
          role: 'agent', 
          content: `Hello! I've analyzed **${fileList[0].name}**. How can I help you with this document?` 
        }]);
        setActivePreviewUrl(uploadedFiles[0].previewUrl);
        setShowPreview(true);
      } else {
        setMessages([{ 
          role: 'agent', 
          content: `I've successfully indexed **${fileList.length} documents**: \n${fileList.map(f => `- ${f.name}`).join('\n')}\n\nYou can now ask me to compare them, summarize them, or find specific details across the set.` 
        }]);
      }
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

  const resetState = () => {
    const newSessionId = `session_${Math.random().toString(36).substring(2, 11)}`;
    setSessionId(newSessionId);
    localStorage.setItem('last_session_id', newSessionId);
    setIsUploaded(false);
    setFiles([]);
    setMessages([]);
    setError(null);
    setMode('selection');
    setShowPreview(false);
    setActivePreviewUrl(null);
  };

  return (
    <div className="flex h-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 glass z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={resetState}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Bot size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight">DocuMind AI</h1>
                <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">Enterprise Intelligence</p>
              </div>
            </button>
            
            {mode !== 'selection' && (
              <div className="h-6 w-[1px] bg-white/10 mx-2 hidden md:block"></div>
            )}
            
            {mode !== 'selection' && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-zinc-900 rounded-full border border-white/5">
                {mode === 'single' ? <FileText size={12} className="text-blue-400" /> : <Files size={12} className="text-purple-400" />}
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {mode === 'single' ? 'Single Doc Mode' : 'Multi-Doc Analysis'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isUploaded && mode === 'single' && (
              <button 
                onClick={() => setShowPreview(!showPreview)}
                className={`p-2 rounded-lg transition-all ${showPreview ? 'bg-blue-600/10 text-blue-400' : 'text-zinc-500 hover:text-white'}`}
                title="Toggle Preview"
              >
                <FileText size={18} />
              </button>
            )}
            <button 
              onClick={resetState}
              className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-all group"
              title="Reset to Home"
            >
              <RefreshCcw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>

          {mode === 'selection' ? (
            /* Selection Stage */
            <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="text-center mb-16">
                <h2 className="text-5xl md:text-6xl font-black mb-6 leading-tight tracking-tighter">
                  Choose your <br /> 
                  <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent italic">Intelligence.</span>
                </h2>
                <p className="text-zinc-500 text-lg max-w-lg mx-auto font-medium">
                  Select a specialized analysis tool to begin interacting with your data.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                {/* Single Doc Card */}
                <button 
                  onClick={() => {
                    setMode('single');
                    setError(null);
                  }}
                  className="group relative flex flex-col items-start p-8 bg-zinc-900/20 border border-white/5 rounded-[32px] hover:bg-zinc-900/40 hover:border-blue-500/30 transition-all duration-500 text-left"
                >
                  <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                    <FileText className="text-blue-400" size={28} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Single Document Chat</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed mb-8">
                    Deep dive into a single PDF or report. Ask questions, get summaries, and extract key data points instantly.
                  </p>
                  <div className="mt-auto flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-400 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-[-10px] group-hover:translate-x-0">
                    Get Started <ChevronRight size={14} />
                  </div>
                </button>

                {/* Multi Doc Card */}
                <button 
                  onClick={() => {
                    setMode('multi');
                    setError(null);
                  }}
                  className="group relative flex flex-col items-start p-8 bg-zinc-900/20 border border-white/5 rounded-[32px] hover:bg-zinc-900/40 hover:border-purple-500/30 transition-all duration-500 text-left"
                >
                  <div className="w-14 h-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                    <Files className="text-purple-400" size={28} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Multi-Doc Comparison</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed mb-8">
                    Analyze multiple documents simultaneously. Compare versions, contrast policies, and find cross-document patterns.
                  </p>
                  <div className="mt-auto flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-[-10px] group-hover:translate-x-0">
                    Begin Analysis <ChevronRight size={14} />
                  </div>
                </button>
              </div>
            </div>
          ) : !isUploaded ? (
            /* Upload Stage */
            <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in slide-in-from-bottom-4 duration-500">
              <button 
                onClick={() => {
                  setMode('selection');
                  setError(null);
                }}
                className="mb-12 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm font-semibold"
              >
                <ArrowLeft size={16} /> Back to Tools
              </button>

              <div className="text-center mb-10">
                <h2 className="text-3xl font-black mb-3">
                  Upload {mode === 'single' ? 'your document' : 'multiple documents'}
                </h2>
                <p className="text-zinc-500 text-sm font-medium">
                  {mode === 'single' 
                    ? 'Select a PDF, DOCX, or TXT file to begin analysis.' 
                    : 'Select up to 10 files to compare and contrast simultaneously.'}
                </p>
              </div>

              <label className="relative group cursor-pointer">
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  accept=".pdf,.docx,.txt"
                  multiple={mode === 'multi'}
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
                      <Loader2 size={48} className="text-blue-500 animate-spin" />
                      <div className="text-center px-6">
                        <p className="text-base font-bold text-white mb-1">Indexing...</p>
                        <p className="text-xs text-zinc-500 font-medium">Building knowledge graph</p>
                      </div>
                    </>
                  ) : (
                    <> 
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${mode === 'single' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                        <Upload size={28} />
                      </div>
                      <div className="text-center px-6">
                        <p className="text-sm font-bold text-white mb-1">Click to select</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">PDF, DOCX, TXT</p>
                      </div>
                    </>
                  )}
                </div>
              </label>

              {error && (
                <div className="mt-8 flex items-center gap-3 text-red-400 bg-red-400/5 px-6 py-3 rounded-2xl border border-red-400/10">
                  <AlertCircle size={18} />
                  <span className="text-sm font-semibold">{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Chat Stage */
            <div className="flex-1 flex min-w-0 animate-in fade-in duration-700">
              <ChatInterface 
                messages={messages}
                inputText={inputText}
                setInputText={setInputText}
                isThinking={isThinking}
                onSendMessage={handleSendMessage}
                onClearChat={() => setMessages([])}
                mode={mode === 'multi' ? 'multi' : 'single'}
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
