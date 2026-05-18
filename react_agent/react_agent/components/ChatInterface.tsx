'use client';
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Send, User, Bot, Copy, Check, Trash2, FileText, Sparkles, X, AtSign, Upload, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message { role: 'user' | 'agent'; content: string; }
interface Document { id: number; filename: string; summary?: string; suggestions?: string; }

interface ChatInterfaceProps {
  messages: Message[];
  inputText: string;
  setInputText: (text: string) => void;
  isThinking: boolean;
  onSendMessage: (e?: React.FormEvent, message?: string) => void;
  onClearChat: () => void;
  mode: 'single' | 'multi';
  availableDocuments: Document[];
  onDocumentSelect: (doc: Document) => void;
  selectedDocs?: Document[];
  onUploadDocuments?: (files: FileList) => Promise<void>;
  isUploadingDocuments?: boolean;
}

const isFilenameOnly = (s: string) =>
  !s.includes('\n') && /^[\w\s\-_()\[\].,]+\.[a-zA-Z0-9]{2,6}$/.test(s.trim());

const FilenameBadge = ({ name }: { name: string }) => (
  <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md text-sm font-bold mx-0.5">
    <FileText size={11} className="shrink-0" />{name}
  </span>
);

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages, inputText, setInputText, isThinking,
  onSendMessage, onClearChat, mode, availableDocuments, onDocumentSelect, selectedDocs = [],
  onUploadDocuments, isUploadingDocuments = false,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [taggedDocs, setTaggedDocs] = useState<Document[]>([]);
  // Suggestions live above the input — updated to latest agent message only

  // Parse suggestions from latest agent message and strip from display
  const processedMessages = useMemo(() => messages.map((msg) => {
    if (msg.role !== 'agent') return { ...msg, displayContent: msg.content };
    const match = msg.content.match(/Suggestions:\s*(.+)$/im);
    let displayContent = msg.content;
    let parsedSuggestions: string[] = [];
    if (match) {
      parsedSuggestions = match[1].split('|').map(s => s.trim().replace(/^\[|\]$/g, '').trim()).filter(Boolean);
      displayContent = msg.content.replace(/Suggestions:\s*(.+)$/im, '').trim();
    }
    return { ...msg, displayContent, parsedSuggestions };
  }), [messages]);

  // Update the suggestions bar whenever messages change — only from the latest agent message
  const suggestions = useMemo<string[]>(() => {
    const lastAgent = [...processedMessages].reverse().find(m => m.role === 'agent') as any;
    return lastAgent?.parsedSuggestions?.length ? lastAgent.parsedSuggestions : [];
  }, [processedMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const resizeInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 260)}px`;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);
    const m = value.match(/@(\w*)$/);
    setShowMentions(!!m);
    setMentionFilter(m ? m[1].toLowerCase() : '');
    requestAnimationFrame(resizeInput);
  };

  useEffect(() => {
    resizeInput();
  }, [inputText, resizeInput]);

  const insertMention = useCallback((doc: Document) => {
    setInputText(inputText.replace(/@(\w*)$/, ''));
    setShowMentions(false);
    if (!taggedDocs.find(d => d.id === doc.id)) {
      setTaggedDocs(prev => [...prev, doc]);
      onDocumentSelect(doc);
    }
    inputRef.current?.focus();
  }, [inputText, taggedDocs, onDocumentSelect]);

  const filteredDocs = availableDocuments.filter(d =>
    d.filename.toLowerCase().includes(mentionFilter) && !taggedDocs.find(t => t.id === d.id)
  );

  const handleInlineUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !onUploadDocuments) return;
    try {
      await onUploadDocuments(files);
    } finally {
      event.target.value = '';
    }
  };

  const mdComponents: any = {
    p: ({ children }: any) => {
      if (typeof children === 'string') {
        const parts = children.split(/(@[\w.]+)/g);
        return <div className="mb-3 last:mb-0">{parts.map((p: string, i: number) =>
          /^@[\w.]+$/.test(p)
            ? <span key={i} className="text-blue-400 font-bold bg-blue-500/10 px-1 rounded">{p}</span>
            : p
        )}</div>;
      }
      return <div className="mb-3 last:mb-0">{children}</div>;
    },
    strong: ({ children }: any) => <strong className="font-black">{children}</strong>,
    ul: ({ children }: any) => <ul className="list-disc ml-5 mb-3 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal ml-5 mb-3 space-y-1">{children}</ol>,
    li: ({ children }: any) => <li className="text-muted-foreground">{children}</li>,
    h1: ({ children }: any) => <h1 className="text-2xl font-black mb-3 mt-2">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-xl font-black mb-2 mt-2">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-lg font-black mb-2">{children}</h3>,
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-accent pl-4 italic text-muted-foreground my-3 bg-accent/5 py-2 pr-3 rounded-r-lg">{children}</blockquote>
    ),
    table: ({ children }: any) => (
      <div className="my-4 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left border-collapse bg-card/30">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-muted/60 border-b border-border">{children}</thead>,
    th: ({ children }: any) => <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground whitespace-nowrap">{children}</th>,
    td: ({ children }: any) => <td className="px-3 py-2.5 text-sm border-t border-border/40">{children}</td>,
    tr: ({ children }: any) => <tr className="hover:bg-accent/5 transition-colors">{children}</tr>,
    code: ({ inline, className, children, ...props }: any) => {
      const langMatch = /language-(\w+)/.exec(className || '');
      const codeStr = String(children).replace(/\n$/, '').trim();
      if (isFilenameOnly(codeStr)) return <FilenameBadge name={codeStr} />;
      if (!inline) {
        return (
          <div className="relative group my-4 rounded-xl overflow-hidden border border-border bg-[#0a0a0a]">
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{langMatch?.[1] ?? 'code'}</span>
              <button onClick={(e) => {
                navigator.clipboard.writeText(codeStr);
                const btn = e.currentTarget;
                btn.querySelector('.ci')?.classList.add('hidden');
                btn.querySelector('.ck')?.classList.remove('hidden');
                setTimeout(() => { btn.querySelector('.ci')?.classList.remove('hidden'); btn.querySelector('.ck')?.classList.add('hidden'); }, 2000);
              }} className="p-1 hover:bg-white/10 rounded-lg transition-all">
                <Copy size={13} className="ci text-zinc-500" />
                <Check size={13} className="ck text-emerald-400 hidden" />
              </button>
            </div>
            <pre className="p-4 overflow-x-auto custom-scrollbar text-sm font-mono text-blue-300 leading-relaxed"><code>{children}</code></pre>
          </div>
        );
      }
      return <code className="bg-accent/10 text-accent px-1.5 py-0.5 rounded text-[13px] font-mono font-bold" {...props}>{children}</code>;
    },
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8">
        {processedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-700">
            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-6">
              <Bot size={32} className="text-accent" />
            </div>
            <h3 className="text-xl font-black mb-2">
              {mode === 'single' ? 'Document Ready' : 'Documents Ready'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {mode === 'single'
                ? 'Ask anything — summaries, details, or specific sections.'
                : 'Ask me to compare, summarize, or find differences.'}
            </p>
            {onUploadDocuments && (
              <>
                <input
                  ref={uploadInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.txt,.docx,.csv,.md"
                  onChange={handleInlineUpload}
                  disabled={isUploadingDocuments}
                />
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploadingDocuments}
                  className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploadingDocuments ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {isUploadingDocuments ? 'Uploading...' : 'Add document'}
                </button>
              </>
            )}
            <span className="text-xs text-muted-foreground/40 mt-3">Type @ to mention a specific document</span>
          </div>
        ) : (
          processedMessages.map((msg: any, i: number) => (
            <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex min-w-0 gap-3 ${msg.role === 'user' ? 'max-w-[min(78%,860px)] flex-row-reverse' : 'w-full max-w-5xl'}`}>
                <div className={`mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${msg.role === 'user' ? 'bg-accent text-white' : 'bg-card border border-border'}`}>
                  {msg.role === 'user' ? <User size={15} /> : <Bot size={15} className="text-accent" />}
                </div>
                <div className={`min-w-0 overflow-hidden rounded-2xl px-5 py-4 text-[14px] leading-7 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-tr-md'
                    : 'bg-card/95 text-foreground border border-border rounded-tl-md markdown-content'
                }`}>
                  {msg.role === 'agent' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                      {msg.displayContent}
                    </ReactMarkdown>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.displayContent}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {isThinking && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center">
                <Bot size={15} className="text-accent" />
              </div>
              <div className="bg-card px-4 py-3 rounded-2xl rounded-tl-none border border-border flex items-center gap-3">
                <div className="flex gap-1">
                  {['-0.3s', '-0.15s', '0s'].map((d, i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-duration:0.8s]" style={{ animationDelay: d }} />
                  ))}
                </div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Thinking…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="relative z-10 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">

          {/* Suggestions bar — updates to latest agent response suggestions */}
          {!isThinking && suggestions.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 animate-in fade-in duration-300">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(undefined, s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border hover:border-accent hover:bg-accent/5 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Sparkles size={10} className="text-accent" />{s}
                </button>
              ))}
            </div>
          )}

          {/* Tagged doc chips */}
          {taggedDocs.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {taggedDocs.map(doc => (
                <span key={doc.id} className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-lg text-xs font-bold">
                  <FileText size={10} />{doc.filename}
                  <button onClick={() => setTaggedDocs(p => p.filter(d => d.id !== doc.id))} className="hover:text-blue-200 ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Mention dropdown + input */}
          <div className="relative">
            {onUploadDocuments && (
              <div className="mb-2 flex justify-end">
                <input
                  ref={uploadInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.txt,.docx,.csv,.md"
                  onChange={handleInlineUpload}
                  disabled={isUploadingDocuments}
                />
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isUploadingDocuments}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploadingDocuments ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {isUploadingDocuments ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            )}
            {showMentions && filteredDocs.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-72 max-w-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2">
                <div className="px-3 py-2 bg-muted/40 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <AtSign size={10} /> Mention Document
                </div>
                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                  {filteredDocs.map(doc => (
                    <button key={doc.id} onMouseDown={e => { e.preventDefault(); insertMention(doc); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold hover:bg-accent hover:text-white transition-colors">
                      <FileText size={13} className="shrink-0" /><span className="truncate">{doc.filename}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={onSendMessage} className="relative group w-full">
              <div className="absolute -inset-0.5 bg-accent/20 rounded-[24px] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
              <textarea
                ref={inputRef} value={inputText} onChange={handleInputChange}
                placeholder="Ask anything… (@ to mention a document)"
                rows={1}
                className="relative block w-full min-h-[72px] max-h-[240px] resize-none overflow-y-auto rounded-[22px] border border-border bg-card px-5 py-4 pr-16 text-[14px] leading-6 shadow-2xl shadow-black/20 transition-all placeholder:text-muted-foreground/40 focus:border-accent focus:outline-none custom-scrollbar"
                disabled={isThinking}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSendMessage();
                  }
                }}
              />
              <button type="submit" disabled={!inputText.trim() || isThinking}
                className={`absolute right-3 bottom-3 flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200 ${
                  inputText.trim() && !isThinking ? 'bg-accent text-white shadow-lg shadow-accent/20 hover:scale-105 active:scale-95' : 'bg-muted text-muted-foreground'
                }`}>
                <Send size={16} />
              </button>
            </form>
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />Agent Active
            </div>
            {messages.length > 0 && (
              <button onClick={onClearChat} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-500 font-bold uppercase tracking-widest transition-colors">
                <Trash2 size={10} />Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
