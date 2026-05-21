import React, { useState, useEffect, useRef } from 'react';
import {
  Home, MessageSquare, LogOut, ChevronLeft, ChevronRight,
  Plus, History, Bot, Clock, MoreVertical, Edit2, Trash2, X, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Session {
  id: string;
  title: string;
  created_at: string;
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeView: 'home' | 'doc-select' | 'chat';
  setActiveView: (view: 'home' | 'doc-select' | 'chat') => void;
  sessions: Session[];
  currentSessionId?: string;
  draftSessionId?: string | null;
  draftSessionTitle?: string | null;
  optimisticSession?: Session | null;
  onSessionSelect: (sessionId: string) => void;
  onSessionRename?: (sessionId: string, newTitle: string) => void;
  onSessionDelete?: (sessionId: string) => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setIsOpen,
  activeView,
  setActiveView,
  sessions,
  currentSessionId,
  draftSessionId,
  draftSessionTitle,
  optimisticSession,
  onSessionSelect,
  onSessionRename,
  onSessionDelete,
  onNewChat,
}) => {
  const { logout, user } = useAuth();
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRenameSubmit = (e: React.FormEvent, sessionId: string) => {
    e.preventDefault();
    if (renameText.trim() && onSessionRename) {
      onSessionRename(sessionId, renameText.trim());
    }
    setRenamingId(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    if (diffH < 24) return diffH === 0 ? 'Just now' : `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString();
  };

  let visibleSessions = sessions;

  if (
    optimisticSession &&
    !visibleSessions.some(session => session.id === optimisticSession.id)
  ) {
    visibleSessions = [optimisticSession, ...visibleSessions];
  }

  if (
    draftSessionId &&
    draftSessionTitle &&
    !visibleSessions.some(session => session.id === draftSessionId)
  ) {
    visibleSessions = [
      {
        id: draftSessionId,
        title: draftSessionTitle,
        created_at: new Date().toISOString(),
      },
      ...visibleSessions,
    ];
  }

  return (
    <>
      <aside
        className={`bg-card border-r border-border transition-all duration-300 flex flex-col flex-shrink-0 ${
          isOpen ? 'w-64' : 'w-[72px]'
        }`}
      >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border h-16 flex-shrink-0">
        {isOpen && (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/30">
              <Bot size={16} className="text-white" />
            </div>
            <span className="font-black tracking-tight text-base">DocuMind</span>
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-muted rounded-xl transition-colors ml-auto"
        >
          {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col overflow-hidden p-3 gap-1">

        {/* Documents link */}
        <button
          onClick={() => setActiveView('home')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
            activeView === 'home'
              ? 'bg-accent text-white shadow-lg shadow-accent/20'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
          title={!isOpen ? 'Documents' : undefined}
        >
          <Home size={18} className="flex-shrink-0" />
          {isOpen && <span className="font-bold text-sm">Documents</span>}
        </button>

        {/* Divider */}
        <div className="my-2 border-t border-border/50" />

        {/* Chat History section header */}
        <div className={`flex items-center justify-between px-1 mb-1 ${!isOpen ? 'justify-center' : ''}`}>
          {isOpen && (
            <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.18em]">
              Chat History
            </span>
          )}
          <button
            onClick={onNewChat}
            className="p-1.5 hover:bg-accent/10 rounded-lg text-accent transition-colors"
            title="New Chat"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5 min-h-0">
          {visibleSessions.length === 0 ? (
            isOpen && (
              <div className="flex flex-col items-center justify-center py-8 px-2 text-center">
                <MessageSquare size={24} className="text-muted-foreground/30 mb-2" />
                <p className="text-[10px] text-muted-foreground/40 font-bold">No chats yet</p>
              </div>
            )
          ) : (
            visibleSessions.map(session => (
              <div key={session.id} className="relative group">
                {renamingId === session.id && isOpen ? (
                  <form 
                    onSubmit={(e) => handleRenameSubmit(e, session.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all bg-accent/10 text-accent border border-accent/20`}
                  >
                    <History size={14} className="flex-shrink-0" />
                    <input
                      autoFocus
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="flex-1 min-w-0 bg-transparent text-xs font-bold outline-none"
                    />
                    <button 
                      type="submit" 
                      className="p-1 hover:bg-accent/20 rounded"
                    >
                      <Check size={12} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setRenamingId(null)} 
                      className="p-1 hover:bg-accent/20 rounded"
                    >
                      <X size={12} />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      if (session.id === draftSessionId && !currentSessionId) return;
                      onSessionSelect(session.id);
                    }}
                    title={!isOpen ? session.title : undefined}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group ${
                      currentSessionId === session.id || (!currentSessionId && draftSessionId === session.id)
                        ? 'bg-accent/10 text-accent border border-accent/20'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                    disabled={session.id === draftSessionId && !currentSessionId}
                  >
                    <History size={14} className="flex-shrink-0" />
                    {isOpen && (
                      <div className="flex-1 min-w-0 flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-xs font-bold truncate">{session.title}</p>
                          <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mt-0.5">
                            <Clock size={9} />
                            {formatDate(session.created_at)}
                          </p>
                        </div>
                        {!(session.id === draftSessionId && !currentSessionId) && (
                          <div 
                            className={`opacity-0 group-hover:opacity-100 transition-opacity ${activeMenuId === session.id ? 'opacity-100' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === session.id ? null : session.id);
                            }}
                          >
                            <MoreVertical size={14} className="text-muted-foreground hover:text-foreground" />
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                )}
                {activeMenuId === session.id && isOpen && (
                  <div 
                    ref={menuRef}
                    className="absolute right-4 top-10 w-32 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                  >
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted transition-colors text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(null);
                        setRenameText(session.title);
                        setRenamingId(session.id);
                      }}
                    >
                      <Edit2 size={12} /> Rename
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-red-500/10 text-red-500 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(null);
                        setSessionToDelete(session);
                      }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border flex-shrink-0">
        {isOpen && (
          <div className="px-3 mb-3">
            <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-0.5">
              Signed in as
            </p>
            <p className="text-sm font-bold truncate text-foreground/80">{user?.email}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-all"
          title={!isOpen ? 'Logout' : undefined}
        >
          <LogOut size={16} className="flex-shrink-0" />
          {isOpen && <span className="font-bold text-sm">Logout</span>}
        </button>
      </div>
    </aside>
      
      {sessionToDelete && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-sm rounded-3xl p-6 shadow-2xl shadow-black/20 animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-black mb-2">Delete Chat</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete <span className="font-bold text-foreground">"{sessionToDelete.title}"</span>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onSessionDelete) onSessionDelete(sessionToDelete.id);
                  setSessionToDelete(null);
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
