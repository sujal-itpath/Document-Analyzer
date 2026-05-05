'use client';

import React, { useState, useEffect } from 'react';
import { 
  Upload, FileText, Bot, Loader2, CheckCircle2, 
  AlertCircle, RefreshCcw, Files, LayoutGrid, 
  ChevronRight, MessageSquare, ArrowLeft, Plus,
  Sun, Moon, Sparkles, Wand2
} from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import DocumentPreview from '../components/DocumentPreview';

type AppMode = 'upload' | 'chat'    ;

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
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);  

  // Initialize session on mount
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

      setIsUploaded(true);
      setMode('chat');
      
      const uploadedFiles = fileList.map(f => ({ 
        name: f.name, 
        previewUrl: `http://localhost:8000/preview/${encodeURIComponent(f.name)}`
      }));
      
      setFiles(uploadedFiles);
      
      const fileCount = fileList.length;
      const fileNames = fileList.map(f => f.name).join(', ');

      setMessages([{ 
        role: 'agent', 
        content: fileCount === 1 
          ? `Hello! I've analyzed **${fileNames}**. How can I help you with this document?`
          : `I've successfully indexed **${fileCount} documents**: \n${fileList.map(f => `- ${f.name}`).join('\n')}\n\nYou can now ask me to compare them, summarize them, or find specific details across the set.`
      }]);

      setSuggestions(defaultSuggestions);

      if (fileCount === 1) {
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

      // Parse suggestions from final response
      const suggestionMatch = accumulatedResponse.match(/Suggestions:\s*(.*)$/m);
      if (suggestionMatch) {
        const suggestionText = suggestionMatch[1];
        const suggestionList = suggestionText.split('|').map((s, i) => ({
          id: `suggestion_${Date.now()}_${i}`,
          label: s.trim(),
          icon: <Sparkles size={14} />
        })).filter(s => s.label);
        
        if (suggestionList.length > 0) {
          setSuggestions(suggestionList);
          // Clean up the message content to remove the "Suggestions: ..." line
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
    setMode('upload');
    setShowPreview(false);
    setActivePreviewUrl(null);
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-sans selection:bg-accent/30 overflow-hidden transition-colors duration-300">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border glass z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={resetState}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Bot size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight">DocuMind AI</h1>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Intelligent Analysis</p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            {isUploaded && (
              <button 
                onClick={() => setShowPreview(!showPreview)}
                className={`p-2.5 rounded-xl transition-all ${showPreview ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
                title="Toggle Preview"
              >
                <FileText size={20} />
              </button>
            )}
            
            <button 
              onClick={resetState}
              className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all group"
              title="New Session"
            >
              <RefreshCcw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden relative">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>

          {!isUploaded ? (
            /* Upload Stage */
            <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 text-accent rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
                  <Sparkles size={12} />
                  Next-Gen Document Intelligence
                </div>
                <h2 className="text-5xl md:text-6xl font-black mb-6 tracking-tight leading-tight">
                  Unlock the knowledge in <br />
                  <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent italic">your documents.</span>
                </h2>
                <p className="text-muted-foreground text-lg max-w-xl mx-auto font-medium">
                  Upload one or more files and let our agent analyze, compare, and extract insights instantly.
                </p>
              </div>

              <label className="relative group cursor-pointer">
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  accept=".pdf,.docx,.txt,.csv"
                  multiple
                  disabled={isUploading}
                />
                <div className={`
                  w-72 h-72 rounded-[48px] border-2 border-dashed
                  transition-all duration-500 flex flex-col items-center justify-center gap-6
                  ${isUploading 
                    ? 'bg-accent/5 border-accent animate-pulse' 
                    : 'bg-card border-border hover:border-accent hover:bg-muted/50 shadow-2xl shadow-black/5'}
                `}>
                  {isUploading ? (
                    <>                        
                      <Loader2 size={48} className="text-accent animate-spin" />
                      <div className="text-center px-6">
                        <p className="text-base font-bold mb-1">Processing...</p>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Building Knowledge Graph</p>
                      </div>
                    </>
                  ) : (
                    <> 
                      <div className="w-20 h-20 rounded-3xl bg-accent/10 text-accent flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                        <Upload size={32} />
                      </div>
                      <div className="text-center px-6">
                        <p className="text-lg font-bold mb-1">Drop documents here</p>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">PDF, DOCX, TXT, CSV</p>
                      </div>
                    </>
                  )}
                </div>
              </label>

              {error && (
                <div className="mt-8 flex items-center gap-3 text-red-500 bg-red-500/5 px-6 py-4 rounded-2xl border border-red-500/10 animate-in fade-in zoom-in-95">
                  <AlertCircle size={20} />
                  <span className="text-sm font-bold">{error}</span>
                </div>
              )}

              <div className="mt-16 grid grid-cols-3 gap-8 text-center max-w-2xl">
                {[
                  { label: 'Instant Summaries', icon: <FileText size={18} /> },
                  { label: 'Cross-Doc Analysis', icon: <Files size={18} /> },
                  { label: 'Deep Search', icon: <Bot size={18} /> },
                ].map((feat, i) => (
                  <div key={i} className="flex flex-col items-center gap-3">
                    <div className="text-muted-foreground/40">{feat.icon}</div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{feat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Chat Stage */
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
