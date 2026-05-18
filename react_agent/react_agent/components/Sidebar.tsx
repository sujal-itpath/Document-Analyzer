import React from 'react';
import {
  Home, MessageSquare, LogOut, ChevronLeft, ChevronRight,
  Plus, History, Bot, Clock
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
  onNewChat,
}) => {
  const { logout, user } = useAuth();

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
              <button
                key={session.id}
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
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">{session.title}</p>
                    <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mt-0.5">
                      <Clock size={9} />
                      {formatDate(session.created_at)}
                    </p>
                  </div>
                )}
              </button>
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
  );
};

export default Sidebar;
