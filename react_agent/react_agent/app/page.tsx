'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, FileText, Bot, User, Loader2, CheckCircle2, AlertCircle, RefreshCcw, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function Home() {
  const [isUploaded, setIsUploaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);0

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
        body: JSON.stringify({ question: userMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from agent');
      }

      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'agent', content: data.answer }]);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setMessages((prev) => [...prev, { role: 'agent', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  const resetAnalysis = () => {
    setIsUploaded(false);
    setFile(null);
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 glass sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bot size={22} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-bold tracking-tight">DocuMind AI</h1>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Enterprise Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isUploaded && (
            <>
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 rounded-full border border-white/10">
                <FileText size={14} className="text-blue-400" />
                <span className="text-xs font-semibold text-zinc-400 truncate max-w-[120px]">{file?.name}</span>
                <CheckCircle2 size={12} className="text-emerald-500" />
              </div>
              <button 
                onClick={resetAnalysis}
                className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-all group"
                title="New Analysis"
              >
                <RefreshCcw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
              </button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 md:p-8 relative">
        {!isUploaded ? (
          /* Upload Stage */
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -z-10"></div>
            
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-6xl font-black mb-6 leading-tight tracking-tighter">
                Chat with your <br /> 
                <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Documents.</span>
              </h2>
              <p className="text-zinc-500 text-lg max-w-xl mx-auto font-medium">
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
                w-64 h-64 md:w-80 md:h-80 rounded-[40px] border border-white/10
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
                    <div className="w-20 h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-blue-500/10 transition-all duration-500">
                      <Upload size={32} className="text-zinc-400 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <div className="text-center px-6">
                      <p className="text-base font-bold text-white mb-1">Click to upload</p>
                      <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">PDF, DOCX, TXT</p>
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
          /* Chat Stage */
          <div className="flex-1 flex flex-col bg-[#050505] rounded-[32px] overflow-hidden shadow-2xl border border-white/5 animate-in slide-in-from-bottom-8 duration-700">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-4 max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`
                      w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg
                      ${msg.role === 'user' ? 'bg-blue-600' : 'bg-zinc-900 border border-white/10'}
                    `}>
                      {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                    </div>
                    <div className={`
                      p-4 md:p-5 rounded-2xl text-[15px] leading-relaxed shadow-sm
                      ${msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-zinc-900/50 text-zinc-200 border border-white/5 rounded-tl-none markdown-content'}
                    `}>
                      {msg.role === 'agent' ? (
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({children}) => <p className="mb-4 last:mb-0">{children}</p>,
                            strong: ({children}) => <strong className="font-black text-white">{children}</strong>,
                            ul: ({children}) => <ul className="list-disc ml-4 mb-4 space-y-2">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal ml-4 mb-4 space-y-2">{children}</ol>,
                            li: ({children}) => <li className="text-zinc-300">{children}</li>,
                            h1: ({children}) => <h1 className="text-xl font-bold mb-4 text-white">{children}</h1>,
                            h2: ({children}) => <h2 className="text-lg font-bold mb-3 text-white">{children}</h2>,
                            h3: ({children}) => <h3 className="text-md font-bold mb-2 text-white">{children}</h3>,
                            blockquote: ({children}) => <blockquote className="border-l-2 border-blue-500 pl-4 italic text-zinc-400 my-4">{children}</blockquote>,
                            code: ({children}) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="flex gap-4">
                    <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <Bot size={18} />
                    </div>
                    <div className="bg-zinc-900/30 px-5 py-4 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-3">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce [animation-duration:1s] [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce [animation-duration:1s] [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce [animation-duration:1s]"></div>
                      </div>
                      <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Thinking</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-black/40 border-t border-white/5 backdrop-blur-xl">
              <form onSubmit={handleSendMessage} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ask a question about the document..."
                  className="relative w-full bg-zinc-900/50 border border-white/10 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-600 text-sm md:text-base"
                  disabled={isThinking}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isThinking}
                  className={`
                    absolute right-2 top-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300
                    ${inputText.trim() && !isThinking ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-100' : 'bg-zinc-800/50 text-zinc-600 scale-95'}
                  `}
                >
                  <Send size={18} />
                </button>
              </form>
              <div className="mt-4 flex justify-between items-center px-2">
                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
                  Powered by Agentic RAG
                </p>
                {messages.length > 0 && (
                  <button 
                    onClick={() => setMessages([messages[0]])}
                    className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-red-400 font-bold uppercase tracking-widest transition-colors"
                  >
                    <Trash2 size={10} />
                    Clear Chat
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      {!isUploaded && (
        <footer className="py-8 px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">
          <p>© 2026 DocuMind AI. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-blue-400 transition-colors">Documentation</a>
            <a href="#" className="hover:text-blue-400 transition-colors">API Reference</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Status</a>
          </div>
        </footer>
      )}
    </div>
  );
}
