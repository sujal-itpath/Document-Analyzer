import React, { useRef, useEffect, useState } from 'react';
import { Send, User, Bot, Loader2, Copy, Check, Trash2, FileText, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'agent';
  content: string;
}

interface Document {
  id: number;
  filename: string;
  summary?: string;
  suggestions?: string;
}

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
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages, 
  inputText,
  setInputText,
  isThinking,
  onSendMessage,
  onClearChat,
  mode,
  availableDocuments,
  onDocumentSelect
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [quickPrompts, setQuickPrompts] = useState<{label: string, icon: any}[]>([]);

  useEffect(() => {
    // Generate dynamic suggestions from documents
    const allSuggestions: string[] = [];
    availableDocuments.forEach(doc => {
      if (doc.suggestions) {
        try {
          const suggestionsList = JSON.parse(doc.suggestions);
          if (Array.isArray(suggestionsList)) {
            allSuggestions.push(...suggestionsList);
          }
        } catch (e) {}
      }
    });
    
    setQuickPrompts(allSuggestions.slice(0, 4).map((s, i) => ({
      label: s,
      icon: <Sparkles size={12} />
    })));
  }, [availableDocuments]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);

    const lastChar = value[value.length - 1];
    const mentionMatch = value.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setShowMentions(true);
      setMentionFilter(mentionMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (doc: Document) => {
    const newValue = inputText.replace(/@(\w*)$/, `@${doc.filename} `);
    setInputText(newValue);
    setShowMentions(false);
    onDocumentSelect(doc);
  };

  const filteredDocs = availableDocuments.filter(doc => 
    doc.filename.toLowerCase().includes(mentionFilter)
  );

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden transition-colors duration-300">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-700">
             <div className="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center mb-8">
               <Bot size={40} className="text-accent"/>
             </div>
             <h3 className="text-2xl font-black mb-3">
               {mode === 'single' ? 'Analyzing your document...' : 'Comparing your documents...'}
             </h3>
              <p className="text-muted-foreground text-base max-w-md mx-auto">  
                {mode === 'single' 
                  ? "I've analyzed your document. You can ask me to summarize it, find specific details, or explain complex sections."
                  : "I've indexed your documents. You can ask me to compare them, find contradictions, or summarize key differences."}
                <br/>
                <span className="text-xs font-bold mt-4 block opacity-60">Try typing @ to mention a document</span>
              </p>
          </div>
        ) : ( 
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex gap-4 max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`
                  w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl
                  ${msg.role === 'user' ? 'bg-accent text-white' : 'bg-card border border-border'}
                `}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={20} className="text-accent" />}
                </div> 
                <div className={`
                  p-4 md:p-6 rounded-3xl text-[15px] leading-relaxed shadow-sm
                  ${msg.role === 'user' 
                    ? 'bg-accent text-white rounded-tr-none' 
                    : 'bg-card text-foreground border border-border rounded-tl-none markdown-content'}
                `}>
                  {msg.role === 'agent' ? (
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({children}) => <div className="mb-4 last:mb-0">{children}</div>,
                        strong: ({children}) => <strong className="font-black text-foreground">{children}</strong>,
                        ul: ({children}) => <ul className="list-disc ml-6 mb-4 space-y-2">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal ml-6 mb-4 space-y-2">{children}</ol>,
                        li: ({children}) => <li className="text-muted-foreground">{children}</li>,
                        h1: ({children}) => <h1 className="text-2xl font-black mb-4">{children}</h1>,
                        h2: ({children}) => <h2 className="text-xl font-black mb-3">{children}</h2>,
                        h3: ({children}) => <h3 className="text-lg font-black mb-2">{children}</h3>,
                        blockquote: ({children}) => <blockquote className="border-l-4 border-accent pl-4 italic text-muted-foreground my-4 bg-accent/5 py-2 rounded-r-lg">{children}</blockquote>,
                        code: ({ inline, className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          
                          if (!inline) {
                            return (
                              <div className="relative group my-6 rounded-2xl overflow-hidden border border-border bg-[#0a0a0a]">
                                <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/5">
                                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                    {match ? match[1] : 'code'}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      navigator.clipboard.writeText(codeString);
                                      const btn = e.currentTarget;
                                      const icon = btn.querySelector('.copy-icon');
                                      const check = btn.querySelector('.check-icon');
                                      if (icon && check) {
                                        icon.classList.add('hidden');
                                        check.classList.remove('hidden');
                                        setTimeout(() => {
                                          icon.classList.remove('hidden');  
                                          check.classList.add('hidden');
                                        }, 2000);
                                      }
                                    }}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-all group/btn"
                                    title="Copy Code"
                                  >
                                    <Copy size={14} className="copy-icon text-zinc-500 group-hover/btn:text-white" />
                                    <Check size={14} className="check-icon text-emerald-400 hidden" />
                                  </button>
                                </div>
                                <pre className="p-5 overflow-x-auto custom-scrollbar">
                                  <code className="text-sm font-mono text-blue-300">
                                    {children}
                                  </code>
                                </pre>
                              </div>
                            );
                          }
                          return (
                            <code className="bg-accent/10 text-accent px-1.5 py-0.5 rounded-md text-sm font-mono font-bold" {...props}>
                              {children}
                            </code>
                          );
                        },
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
          ))
        )}
        {isThinking && (
          <div className="flex justify-start animate-in fade-in duration-300">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                <Bot size={20} className="text-accent" />
              </div>
              <div className="bg-card px-6 py-5 rounded-3xl rounded-tl-none border border-border flex items-center gap-4 shadow-sm">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-duration:0.8s]"></div>
                </div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Thinking</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-8 bg-background/80 border-t border-border backdrop-blur-xl relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {/* Mentions Dropdown */}
          {showMentions && filteredDocs.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-64 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2">
              <div className="p-3 bg-muted/50 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mention Document</div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {filteredDocs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => insertMention(doc)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold hover:bg-accent hover:text-white transition-colors"
                  >
                    <FileText size={16} />
                    <span className="truncate">{doc.filename}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Prompts */}
          {!isThinking && quickPrompts && quickPrompts.length > 0 && (
            <div className="flex flex-wrap gap-2.5 animate-in slide-in-from-bottom-2 duration-500">
              {quickPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(undefined, p.label)}
                  className="flex items-center gap-2.5 px-4 py-2 bg-card border border-border hover:border-accent hover:bg-accent/5 rounded-2xl text-xs font-bold transition-all hover:-translate-y-1 hover:shadow-lg active:translate-y-0 group/btn shadow-sm"
                >
                  <span className="text-accent group-hover/btn:scale-110 transition-transform">{p.icon}</span>
                  <span className="text-foreground/80 group-hover/btn:text-foreground">{p.label}</span>
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSendMessage} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-accent/20 to-indigo-500/20 rounded-[24px] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Ask anything about your documents... (Type @ to mention)"
              className="relative w-full bg-card border border-border rounded-[22px] py-5 pl-8 pr-16 focus:outline-none focus:border-accent transition-all placeholder:text-muted-foreground/50 text-base shadow-2xl shadow-black/5"
              disabled={isThinking}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isThinking}
              className={`
                absolute right-2.5 top-2.5 w-11 h-11 rounded-[18px] flex items-center justify-center transition-all duration-300
                ${inputText.trim() && !isThinking ? 'bg-accent text-white shadow-xl shadow-accent/20 scale-100 hover:scale-105 active:scale-95' : 'bg-muted text-muted-foreground scale-95'}
              `} 
            >
              <Send size={20} />
            </button>
          </form>
          
          <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-black uppercase tracking-[0.2em]">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              Agent Active
            </div>
            {messages.length > 0 && (
              <button 
                onClick={onClearChat}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-red-500 font-black uppercase tracking-widest transition-colors"
              >
                <Trash2 size={12} />
                Clear Chat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
