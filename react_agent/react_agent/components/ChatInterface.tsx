import React, { useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Copy, Check, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'agent';
  content: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  inputText: string;
  setInputText: (text: string) => void;
  isThinking: boolean;
  onSendMessage: (e?: React.FormEvent) => void;
  onClearChat: () => void;
  mode: 'single' | 'multi';
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages, 
  inputText,
  setInputText,
  isThinking,
  onSendMessage,
  onClearChat,
  mode
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#050505] overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-700">
             <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
               <Bot size={32} className="text-blue-500"/>
             </div>
             <h3 className="text-xl font-bold mb-2">
               {mode === 'single' ? 'Analyzing your document...' : 'Comparing your documents...'}
             </h3>
              <p className="text-zinc-500 text-sm max-w-md">  
                {mode === 'single' 
                  ? "I've analyzed your document. You can ask me to summarize it, find specific details, or explain complex sections."
                  : "I've indexed your documents. You can ask me to compare them, find contradictions, or summarize key differences."}
              </p>
          </div>
        ) : ( 
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-4 max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
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
                        p: ({children}) => <div className="mb-4 last:mb-0">{children}</div>,
                        strong: ({children}) => <strong className="font-black text-white">{children}</strong>,
                        ul: ({children}) => <ul className="list-disc ml-4 mb-4 space-y-2">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal ml-4 mb-4 space-y-2">{children}</ol>,
                        li: ({children}) => <li className="text-zinc-300">{children}</li>,
                        h1: ({children}) => <h1 className="text-xl font-bold mb-4 text-white">{children}</h1>,
                        h2: ({children}) => <h2 className="text-lg font-bold mb-3 text-white">{children}</h2>,
                        h3: ({children}) => <h3 className="text-md font-bold mb-2 text-white">{children}</h3>,
                        blockquote: ({children}) => <blockquote className="border-l-2 border-blue-500 pl-4 italic text-zinc-400 my-4">{children}</blockquote>,
                        code: ({ inline, className, children, ...props }: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          
                          if (!inline) {
                            return (
                              <div className="relative group my-6 rounded-xl overflow-hidden border border-white/10 bg-zinc-950">
                                <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
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
                                    className="p-1.5 hover:bg-white/10 rounded-md transition-all group/btn"
                                    title="Copy Code"
                                  >
                                    <Copy size={14} className="copy-icon text-zinc-500 group-hover/btn:text-white" />
                                    <Check size={14} className="check-icon text-emerald-400 hidden" />
                                  </button>
                                </div>
                                <pre className="p-4 overflow-x-auto custom-scrollbar">
                                  <code className="text-sm font-mono text-blue-300">
                                    {children}
                                  </code>
                                </pre>
                              </div>
                            );
                          }
                          return (
                            <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono text-blue-300" {...props}>
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
        <form onSubmit={onSendMessage} className="relative group max-w-4xl mx-auto">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={mode === 'single' ? "Ask a question about the document..." : "Ask a question or compare documents..."}
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
        <div className="mt-4 flex justify-between items-center px-2 max-w-4xl mx-auto">
          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
            Powered by Agentic RAG
          </p>
          {messages.length > 0 && (
            <button 
              onClick={onClearChat}
              className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-red-400 font-bold uppercase tracking-widest transition-colors"
            >
              <Trash2 size={10} />
              Clear Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
