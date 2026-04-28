import React from 'react';
import { MessageSquare, Plus, Bot, Clock } from 'lucide-react';

interface SidebarProps {
  history: Array<{ thread_id: string; title: string }>;
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ history, currentSessionId, onSelectSession, onNewChat }) => {
  return (
    <div className="w-64 md:w-72 h-full bg-zinc-950 border-r border-white/5 flex flex-col transition-all duration-300">
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold transition-all group"
        >
          <Plus size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4">
        <div className="px-3 py-4 flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          <Clock size={12} />
          Recent Chats
        </div>
        
        <div className="space-y-1">
          {!Array.isArray(history) || history.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-zinc-600 italic">No history yet</p>
            </div>
          ) : (
            history.map((session, index) => (
              <button
                key={session.thread_id || index}
                onClick={() => onSelectSession(session.thread_id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all
                  ${currentSessionId === session.thread_id 
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}
                `}
              >
                <MessageSquare size={16} className={currentSessionId === session.thread_id ? 'text-blue-400' : 'text-zinc-500'} />
                <span className="truncate text-left flex-1 font-medium">{session.title}</span>
              </button>
            ))
          )}
        </div>                                            
      </div>

      <div className="p-4 border-t border-white/5 mt-auto">
        <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900/50 rounded-xl border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
            <Bot size={16} className="text-zinc-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-200 truncate">DocuMind AI</p>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-tighter">v1.0 Pro</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
