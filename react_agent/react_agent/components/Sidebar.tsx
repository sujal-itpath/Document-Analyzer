import React, { useState, useEffect } from 'react';
import { Home, MessageSquare, LogOut, ChevronLeft, ChevronRight, Files, Plus, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Session {
  id: string;
  title: string;
  created_at: string;
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeView: 'home' | 'chat';
  setActiveView: (view: 'home' | 'chat') => void;
  currentSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  setIsOpen, 
  activeView, 
  setActiveView,
  currentSessionId,
  onSessionSelect,
  onNewChat
}) => {
  const { logout, user, token } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (token) {
      fetchSessions();
    }
  }, [token]);

  const fetchSessions = async () => {
    try {
      const response = await fetch('http://localhost:8000/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  };

  const menuItems = [
    { id: 'home', label: 'Documents', icon: <Home size={20} /> },
  ];

  return (
    <aside className={`bg-card border-r border-border transition-all duration-300 flex flex-col ${isOpen ? 'w-64' : 'w-20'}`}>
      <div className="p-6 flex items-center justify-between border-b border-border">
        {isOpen && <span className="font-black tracking-tighter text-lg">DocuMind</span>}
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 hover:bg-muted rounded-xl transition-colors">
          {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
        <div className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as any)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                activeView === item.id 
                  ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex-shrink-0">{item.icon}</div>
              {isOpen && <span className="font-bold text-sm">{item.label}</span>}
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            {isOpen && <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Chat History</span>}
            <button 
              onClick={onNewChat}
              className="p-1.5 hover:bg-muted rounded-lg text-accent transition-colors"
              title="New Chat"
            >
              <Plus size={18} />
            </button>
          </div>
          
          <div className="space-y-1">
             <button
                onClick={() => setActiveView('chat')}
                className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                  activeView === 'chat' && !currentSessionId
                    ? 'bg-accent/10 text-accent' 
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex-shrink-0"><MessageSquare size={20} /></div>
                {isOpen && <span className="font-bold text-sm">Live Chat</span>}
              </button>

              {isOpen && sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSessionSelect(session.id)}
                  className={`w-full flex items-center gap-3 p-2.5 px-4 rounded-xl text-left transition-all ${
                    currentSessionId === session.id
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <History size={14} className="flex-shrink-0" />
                  <span className="font-medium text-xs truncate">{session.title}</span>
                </button>
              ))}
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-border">
        {isOpen && (
          <div className="mb-4 px-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Logged in as</p>
            <p className="text-sm font-bold truncate">{user?.email}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-4 p-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-all"
        >
          <div className="flex-shrink-0"><LogOut size={20} /></div>
          {isOpen && <span className="font-bold text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
