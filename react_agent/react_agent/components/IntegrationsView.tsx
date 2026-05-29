import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from './ui/Dialog';
import { Link2, Loader2, CheckCircle2, FileText, RefreshCw, XCircle, CloudOff, ChevronDown, BookOpen, GitBranch, Kanban } from 'lucide-react';

interface IntegrationsViewProps {
  onSyncComplete?: () => void;
  projectId?: number;
}

type GoogleDoc = {
  id: string;
  name: string;
  modifiedTime: string;
};

type WorkspaceDoc = {
  id: number;
  filename: string;
  google_doc_id?: string;
};

const IntegrationsView: React.FC<IntegrationsViewProps> = ({ onSyncComplete, projectId }) => {
  const { token, logout } = useAuth();
  const [googleDocs, setGoogleDocs] = useState<GoogleDoc[]>([]);
  const [workspaceDocs, setWorkspaceDocs] = useState<WorkspaceDoc[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const dialog = useDialog();
  const [docsError, setDocsError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  // Track which document is currently being synced/unsynced
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{message: string, isError: boolean} | null>(null);

  const [expandedTool, setExpandedTool] = useState<string | null>('google');

  const handleComingSoon = () => {
    dialog.alert({ title: 'Coming Soon', message: 'This integration is not yet available.' });
  };

  const fetchWorkspaceDocs = async () => {
    try {
      const url = projectId
        ? `http://localhost:8000/documents?project_id=${projectId}`
        : 'http://localhost:8000/documents';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaceDocs(data);
      }
    } catch (err) {
      console.error("Failed to fetch workspace docs:", err);
    }
  };

  const fetchGoogleDocsList = async () => {
    if (!token) return;
    setIsLoadingDocs(true);
    setDocsError(null);
    try {
      const res = await fetch('http://localhost:8000/documents/google/list', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setGoogleDocs(data.documents || []);
        setIsConnected(true);
      } else {
        setIsConnected(false);
        setDocsError("Not connected to Google. Please connect your account above.");
      }
    } catch (err) {
      setIsConnected(false);
      setDocsError("Network error fetching Google Docs.");
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceDocs();
    fetchGoogleDocsList();
  }, [token, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('http://localhost:8000/auth/google/login', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        await dialog.alert({ title: 'Connection Failed', message: data.detail || 'Failed to initialize Google Login', variant: 'danger' });
      }
    } catch (err) {
      console.error("Login redirect failed:", err);
      await dialog.alert({ title: 'Network Error', message: 'Network error trying to reach the server.', variant: 'danger' });
    }
  };

  const handleDisconnectGoogle = async () => {
    const confirmed = await dialog.confirm({
      title: 'Disconnect Google Account',
      message: 'Are you sure you want to disconnect your Google account? You will lose access to sync new documents.',
      confirmLabel: 'Disconnect',
      variant: 'danger'
    });
    if (!confirmed) return;
    
    setIsDisconnecting(true);
    try {
      const res = await fetch('http://localhost:8000/auth/google/disconnect', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setIsConnected(false);
        setGoogleDocs([]);
        setDocsError("Not connected to Google. Please connect your account above.");
      } else {
        await dialog.alert({ title: 'Disconnect Failed', message: 'Failed to disconnect Google account', variant: 'danger' });
      }
    } catch (err) {
      await dialog.alert({ title: 'Network Error', message: 'Network error trying to reach the server.', variant: 'danger' });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const syncDocument = async (doc: GoogleDoc) => {
    setSyncStatus(null);
    setSyncingDocId(doc.id);
    
    try {
      const formData = new FormData();
      formData.append('url', doc.id);
      formData.append('name', doc.name);
      if (projectId) {
        formData.append('project_id', projectId.toString());
      }

      const res = await fetch('http://localhost:8000/documents/google', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      
      if (!res.ok) {
        setSyncStatus({ message: data.detail || "Failed to sync document", isError: true });
        return;
      }

      setSyncStatus({ message: "Successfully synced document!", isError: false });
      await fetchWorkspaceDocs();
      if (onSyncComplete) onSyncComplete();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      setSyncStatus({ message: "Network error during sync.", isError: true });
    } finally {
      setSyncingDocId(null);
    }
  };

  const unsyncDocument = async (doc: GoogleDoc) => {
    const workspaceDoc = workspaceDocs.find(w => w.google_doc_id === doc.id);
    if (!workspaceDoc) return;

    const confirmed = await dialog.confirm({
      title: 'Unsync Document?',
      message: `Are you sure you want to unsync "${doc.name}"?\n\nWarning: This removes it from your AI knowledge base and permanently deletes all associated chat context.`,
      confirmLabel: 'Unsync',
      variant: 'danger'
    });
    if (!confirmed) return;

    setSyncingDocId(doc.id);
    try {
      const res = await fetch(`http://localhost:8000/documents/${workspaceDoc.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        await dialog.alert({ title: 'Unsync Failed', message: err.detail || 'Failed to unsync document', variant: 'danger' });
        return;
      }

      await fetchWorkspaceDocs();
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      await dialog.alert({ title: 'Network Error', message: 'Network error during unsync.', variant: 'danger' });
    } finally {
      setSyncingDocId(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background relative z-0 overflow-y-auto custom-scrollbar">
      {/* Decorative Gradient Background */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-accent/10 to-transparent pointer-events-none -z-10" />
      
      <div className="max-w-4xl mx-auto w-full p-8 pt-12 flex-1">
        <h1 className="text-4xl font-black mb-2 tracking-tight">Integrations Hub</h1>
        <p className="text-muted-foreground mb-12 text-lg">Connect external apps to bring your knowledge base together.</p>

        {/* Sync Status Toast */}
        {syncStatus && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 shadow-lg transform transition-all animate-in slide-in-from-top-4 ${
            syncStatus.isError ? 'bg-red-500/10 border border-red-500/20 text-red-500' : 'bg-green-500/10 border border-green-500/20 text-green-600'
          }`}>
            {syncStatus.isError ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
            <p className="font-bold text-sm">{syncStatus.message}</p>
          </div>
        )}

        <div className="space-y-4 mb-10">
          {/* Google Docs Accordion */}
          <div className={`border rounded-3xl overflow-hidden transition-all duration-300 ${expandedTool === 'google' ? 'border-accent shadow-xl shadow-accent/10 bg-card' : 'border-border/50 bg-card/40 hover:bg-card/60'}`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer" 
              onClick={() => setExpandedTool(expandedTool === 'google' ? null : 'google')}
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center p-3 flex-shrink-0 border border-blue-100">
                  <svg viewBox="0 0 48 48" className="w-full h-full">
                    <path fill="#4285F4" d="M31 4H11C8.79 4 7.02 5.79 7.02 8L7 40c0 2.21 1.77 4 3.98 4H37c2.21 0 4-1.79 4-4V14L31 4z" />
                    <path fill="#1A73E8" d="M30 4L41 15H30V4z" />
                    <path fill="#E8EAED" d="M15 23h18v2H15v-2zm0 6h18v2H15v-2zm0 6h12v2H15v-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-black text-xl">Google Docs</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block px-3 py-1 bg-blue-500/10 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded-full">Read & Write Access</span>
                    {isConnected && <span className="inline-block px-3 py-1 bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-wider rounded-full">Connected</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ChevronDown className={`transition-transform duration-300 text-muted-foreground ${expandedTool === 'google' ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {expandedTool === 'google' && (
              <div className="px-6 pb-6 animate-in slide-in-from-top-4">
                <div className="pt-6 border-t border-border/50">
                  {isConnected === false ? (
                    <div className="flex flex-col items-start max-w-xl">
                      <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                        Connect your Google account to securely sync documents to your AI knowledge base. 
                        The AI can also be granted permission to replace specific text directly inside your docs.
                      </p>
                      <button
                        onClick={handleConnectGoogle}
                        className="px-6 py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/30 hover:shadow-accent/50 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                      >
                        Connect to Google
                      </button>
                    </div>
                  ) : (
                    <div className="animate-in fade-in duration-500">
                      <div className="flex items-end justify-between mb-8 pb-2">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-blue-500/30">
                            <FileText size={24} />
                          </div>
                          <div>
                            <h3 className="font-black text-xl tracking-tight">Your Google Docs</h3>
                            <p className="text-xs text-muted-foreground font-medium mt-1">Select documents to sync to your workspace</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={handleDisconnectGoogle}
                            disabled={isDisconnecting}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
                          >
                            <CloudOff size={14} />
                            {isDisconnecting ? 'Disconnecting...' : 'Disconnect Account'}
                          </button>
                          <button 
                            onClick={fetchGoogleDocsList}
                            disabled={isLoadingDocs}
                            className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border hover:bg-muted rounded-xl text-foreground font-bold text-xs transition-all shadow-sm"
                          >
                            <RefreshCw size={14} className={isLoadingDocs ? "animate-spin" : ""} />
                            Refresh List
                          </button>
                        </div>
                      </div>

                      {isLoadingDocs ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                          <Loader2 size={24} className="animate-spin mb-4 text-accent" />
                          <p className="font-medium text-sm">Loading your Google Docs...</p>
                        </div>
                      ) : docsError ? (
                        <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl">
                          <p className="text-muted-foreground font-medium text-sm">{docsError}</p>
                        </div>
                      ) : googleDocs.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl bg-background">
                          <FileText size={32} className="mx-auto text-muted-foreground/30 mb-4" />
                          <p className="text-base font-bold">No documents found</p>
                          <p className="text-xs text-muted-foreground mt-2">Make sure you have documents in your connected Google Drive.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {googleDocs.map((doc) => {
                            const isSynced = workspaceDocs.some(w => w.google_doc_id === doc.id);
                            const isSyncing = syncingDocId === doc.id;
                            
                            return (
                              <div 
                                key={doc.id} 
                                className={`group flex items-center justify-between p-4 rounded-xl transition-all duration-300 border ${
                                  isSynced 
                                    ? 'bg-accent/5 border-accent/20 shadow-sm' 
                                    : 'bg-background border-border/50 hover:border-accent/30 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-center gap-4 min-w-0 mr-4">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                                    isSynced ? 'bg-accent/10 text-accent' : 'bg-blue-50 text-blue-500'
                                  }`}>
                                    <FileText size={16} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-sm truncate" title={doc.name}>
                                      {doc.name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                      Modified: {new Date(doc.modifiedTime).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex-shrink-0 flex items-center gap-3">
                                  {isSynced && (
                                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-accent bg-accent/10 px-2 py-1 rounded-md">
                                      <CheckCircle2 size={12} /> Synced
                                    </span>
                                  )}
                                  
                                  <button
                                    onClick={() => isSynced ? unsyncDocument(doc) : syncDocument(doc)}
                                    disabled={isSyncing}
                                    className={`min-w-[70px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                      isSyncing
                                        ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                                        : isSynced
                                          ? 'bg-background hover:bg-red-500/10 hover:text-red-500 border border-border hover:border-red-500/20 text-muted-foreground'
                                          : 'bg-accent text-white shadow-md shadow-accent/20 hover:shadow-accent/40 hover:-translate-y-0.5'
                                    }`}
                                  >
                                    {isSyncing ? (
                                      <><Loader2 size={12} className="animate-spin" /> ...</>
                                    ) : isSynced ? (
                                      'Unsync'
                                    ) : (
                                      <><Link2 size={12} /> Sync</>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notion Accordion */}
          <div className={`border rounded-3xl overflow-hidden transition-all duration-300 ${expandedTool === 'notion' ? 'border-accent shadow-xl shadow-accent/10 bg-card' : 'border-border/50 bg-card/40 hover:bg-card/60'}`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer" 
              onClick={() => setExpandedTool(expandedTool === 'notion' ? null : 'notion')}
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center p-3 flex-shrink-0 border border-gray-200 text-black">
                  <BookOpen size={32} />
                </div>
                <div>
                  <h3 className="font-black text-xl">Notion</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block px-3 py-1 bg-gray-500/10 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-full">Read Access</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ChevronDown className={`transition-transform duration-300 text-muted-foreground ${expandedTool === 'notion' ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {expandedTool === 'notion' && (
              <div className="px-6 pb-6 animate-in slide-in-from-top-4">
                <div className="pt-6 border-t border-border/50">
                  <div className="flex flex-col items-start max-w-xl">
                    <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                      Connect your Notion workspace to sync databases and pages. Your AI will be able to search and reference all your structured knowledge.
                    </p>
                    <button
                      onClick={handleComingSoon}
                      className="px-6 py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/30 hover:shadow-accent/50 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                    >
                      Connect to Notion
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* GitHub Accordion */}
          <div className={`border rounded-3xl overflow-hidden transition-all duration-300 ${expandedTool === 'github' ? 'border-accent shadow-xl shadow-accent/10 bg-card' : 'border-border/50 bg-card/40 hover:bg-card/60'}`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer" 
              onClick={() => setExpandedTool(expandedTool === 'github' ? null : 'github')}
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-gray-900 rounded-2xl shadow-sm flex items-center justify-center p-3 flex-shrink-0 border border-gray-800 text-white">
                  <GitBranch size={32} />
                </div>
                <div>
                  <h3 className="font-black text-xl">GitHub</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block px-3 py-1 bg-gray-500/10 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-full">Read & Write Access</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ChevronDown className={`transition-transform duration-300 text-muted-foreground ${expandedTool === 'github' ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {expandedTool === 'github' && (
              <div className="px-6 pb-6 animate-in slide-in-from-top-4">
                <div className="pt-6 border-t border-border/50">
                  <div className="flex flex-col items-start max-w-xl">
                    <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                      Connect GitHub to allow your AI to read repositories, create pull requests, and manage issues directly from your chat.
                    </p>
                    <button
                      onClick={handleComingSoon}
                      className="px-6 py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/30 hover:shadow-accent/50 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                    >
                      Connect to GitHub
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Jira Accordion */}
          <div className={`border rounded-3xl overflow-hidden transition-all duration-300 ${expandedTool === 'jira' ? 'border-accent shadow-xl shadow-accent/10 bg-card' : 'border-border/50 bg-card/40 hover:bg-card/60'}`}>
            <div 
              className="flex items-center justify-between p-6 cursor-pointer" 
              onClick={() => setExpandedTool(expandedTool === 'jira' ? null : 'jira')}
            >
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-[#0052CC] rounded-2xl shadow-sm flex items-center justify-center p-3 flex-shrink-0 border border-blue-800 text-white">
                  <Kanban size={32} />
                </div>
                <div>
                  <h3 className="font-black text-xl">Jira</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block px-3 py-1 bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider rounded-full">Read & Write Access</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <ChevronDown className={`transition-transform duration-300 text-muted-foreground ${expandedTool === 'jira' ? 'rotate-180' : ''}`} />
              </div>
            </div>

            {expandedTool === 'jira' && (
              <div className="px-6 pb-6 animate-in slide-in-from-top-4">
                <div className="pt-6 border-t border-border/50">
                  <div className="flex flex-col items-start max-w-xl">
                    <p className="text-base text-muted-foreground mb-6 leading-relaxed">
                      Connect Jira to track tasks, manage sprints, and sync tickets directly into the AI's context window.
                    </p>
                    <button
                      onClick={handleComingSoon}
                      className="px-6 py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/30 hover:shadow-accent/50 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                    >
                      Connect to Jira
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsView;
