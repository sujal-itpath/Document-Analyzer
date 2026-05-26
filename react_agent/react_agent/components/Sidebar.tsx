import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, MessageSquare, ChevronLeft, ChevronRight, LogOut,
  MoreVertical, MoreHorizontal, Edit2, Trash2, Check, X, History, Clock, Bot,
  FileText, Database, Home, Pin, Moon, Sun
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
  activeView: 'home' | 'doc-select' | 'chat' | 'integrations';
  setActiveView: (view: 'home' | 'doc-select' | 'chat' | 'integrations') => void;
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

const getInitials = (name: string): string => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
};

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
  const { logout, user, updateProfile } = useAuth();

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [pinnedSessions, setPinnedSessions] = useState<string[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const menuRef = useRef<HTMLDivElement>(null);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarColor, setEditAvatarColor] = useState('bg-gradient-to-tr from-accent to-indigo-500');

  useEffect(() => {
    if (user) {
      setEditDisplayName(user.displayName || '');
      setEditUsername(user.username || '');
      setEditAvatarColor(user.avatarColor || 'bg-gradient-to-tr from-accent to-indigo-500');
    }
  }, [user, isEditProfileOpen]);

  useEffect(() => {
    const savedPins = localStorage.getItem('pinned_sessions');
    if (savedPins) setPinnedSessions(JSON.parse(savedPins));

    const savedTheme = localStorage.getItem('app_theme') || 'dark';
    setTheme(savedTheme as 'dark' | 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedSessions(prev => {
      const newPins = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      localStorage.setItem('pinned_sessions', JSON.stringify(newPins));
      return newPins;
    });
    setActiveMenuId(null);
  };

  const handleToggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (editDisplayName.trim() && editUsername.trim()) {
      updateProfile({
        displayName: editDisplayName.trim(),
        username: editUsername.trim(),
        avatarColor: editAvatarColor,
      });
      setIsEditProfileOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileDropdownOpen(false);
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
        className={`bg-card border-r border-border transition-all duration-300 flex flex-col flex-shrink-0 ${isOpen ? 'w-64' : 'w-[72px]'
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
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeView === 'home'
              ? 'bg-accent text-white shadow-lg shadow-accent/20'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            title={!isOpen ? 'Documents' : undefined}
          >
            <Home size={18} className="flex-shrink-0" />
            {isOpen && <span className="font-bold text-sm">Documents</span>}
          </button>

          {/* Integrations link */}
          <button
            onClick={() => setActiveView('integrations')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeView === 'integrations'
              ? 'bg-accent text-white shadow-lg shadow-accent/20'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            title={!isOpen ? 'Integrations' : undefined}
          >
            <div className="flex-shrink-0 relative w-4 h-4 ml-0.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            </div>
            {isOpen && <span className="font-bold text-sm">Integrations</span>}
          </button>

          {/* Divider */}
          <div className="my-2 border-t border-border/50" />

          {/* Chat History section header */}
          <div
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
            className={`flex items-center justify-between px-1 mb-1 cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors ${!isOpen ? 'justify-center' : ''}`}
          >
            {isOpen && (
              <div className="flex items-center gap-1.5">
                {isHistoryExpanded ? <ChevronRight size={12} className="rotate-90 transition-transform" /> : <ChevronRight size={12} className="transition-transform" />}
                <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.18em]">
                  Chat History
                </span>
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onNewChat(); }}
              className="p-1.5 hover:bg-accent/10 rounded-lg text-accent transition-colors cursor-pointer"
              title="New Chat"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Session list */}
          <div className={`flex-1 overflow-y-auto custom-scrollbar space-y-0.5 min-h-0 transition-all ${isHistoryExpanded ? 'opacity-100' : 'opacity-0 h-0 hidden cursor-pointer'}`}>
            {visibleSessions.length === 0 ? (
              isOpen && (
                <div className="flex flex-col items-center justify-center py-8 px-2 text-center">
                  <MessageSquare size={24} className="text-muted-foreground/30 mb-2" />
                  <p className="text-[10px] text-muted-foreground/40 font-bold">No chats yet</p>
                </div>
              )
            ) : (
              [...visibleSessions].sort((a, b) => {
                const aPin = pinnedSessions.includes(a.id);
                const bPin = pinnedSessions.includes(b.id);
                if (aPin && !bPin) return -1;
                if (!aPin && bPin) return 1;
                return 0; // The array is already date sorted from the parent
              }).map(session => (
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
                      className={`w-full cursor-pointer flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group ${currentSessionId === session.id || (!currentSessionId && draftSessionId === session.id)
                        ? 'bg-accent/10 text-accent border border-accent/20'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      disabled={session.id === draftSessionId && !currentSessionId}
                    >
                      {pinnedSessions.includes(session.id) ? (
                        <Pin size={14} className="flex-shrink-0 text-accent fill-accent/20" />
                      ) : (
                        <History size={14} className="flex-shrink-0" />
                      )}
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted transition-colors text-foreground"
                        onClick={(e) => handleTogglePin(session.id, e)}
                      >
                        <Pin size={12} /> {pinnedSessions.includes(session.id) ? 'Unpin' : 'Pin'}
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
        <div className="p-3 border-t border-border flex-shrink-0 space-y-1">
          <button
            onClick={handleToggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-all"
            title={!isOpen ? 'Toggle Theme' : undefined}
          >
            {theme === 'dark' ? <Sun size={16} className="flex-shrink-0" /> : <Moon size={16} className="flex-shrink-0" />}
            {isOpen && <span className="font-bold text-sm text-foreground/80">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <div ref={profileMenuRef} className="relative">
            {/* Profile Dropdown Menu */}
            {isProfileDropdownOpen && (
              <div
                className={`absolute ${
                  isOpen ? 'left-0 right-0 bottom-full mb-2.5 w-full' : 'left-full bottom-0 ml-2.5 w-48'
                } bg-card border border-border rounded-2xl shadow-2xl z-50 p-1.5 space-y-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200`}
              >
                {/* Profile Button */}
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    setIsEditProfileOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted text-foreground/80 hover:text-foreground text-xs font-bold transition-all text-left cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-muted-foreground"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  <span>Profile</span>
                </button>

                {/* Divider */}
                <div className="border-t border-border/50 my-1" />

                {/* Logout Button */}
                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 text-xs font-bold transition-all text-left cursor-pointer"
                >
                  <LogOut size={16} className="flex-shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            )}

            {/* Profile Card Trigger */}
            <button
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className={`w-full flex ${
                isOpen ? 'items-center justify-between p-2.5' : 'justify-center p-2.5'
              } rounded-2xl bg-card border border-border hover:border-foreground/20 hover:bg-muted/10 transition-all text-left cursor-pointer`}
              title={!isOpen ? (user?.email || 'user@example.com') : undefined}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div 
                  className={`w-9 h-9 rounded-xl ${user?.avatarColor || 'bg-gradient-to-tr from-accent to-indigo-500'} text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0`}
                >
                  {getInitials(user?.username || 'U')}
                </div>
                {isOpen && (
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-black truncate text-foreground leading-tight">
                      {user?.username || (user?.email ? user.email.split('@')[0] : 'User')}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                      {user?.email || 'user@example.com'}
                    </span>
                  </div>
                )}
              </div>
              {isOpen && (
                <MoreHorizontal size={14} className={`text-muted-foreground transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-90' : ''} flex-shrink-0`} />
              )}
            </button>
          </div>
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
                className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (onSessionDelete) onSessionDelete(sessionToDelete.id);
                  setSessionToDelete(null);
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-sm rounded-[32px] p-6 shadow-2xl shadow-black/20 animate-in zoom-in-95 duration-300 relative">
            <h3 className="text-xl font-black mb-6 text-foreground">Edit profile</h3>
            
            {/* Avatar Preview Section */}
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="relative animate-in fade-in zoom-in-95 duration-300">
                <div className={`w-24 h-24 rounded-full ${editAvatarColor} text-white flex items-center justify-center font-bold text-3xl shadow-lg border border-border`}>
                  {getInitials(editDisplayName || editUsername || user?.email || 'U')}
                </div>
              </div>
            </div>

            {/* Inputs Form */}
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Username</label>
                <div className="relative group">
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-all font-medium text-foreground pr-10"
                    placeholder="username"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/45">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center my-4 leading-normal">
                Your profile helps people recognize you in group chats.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-5 py-2.5 border border-border hover:bg-muted text-foreground text-sm font-bold rounded-full transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-foreground text-background hover:opacity-90 text-sm font-bold rounded-full transition-opacity cursor-pointer shadow-lg"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
