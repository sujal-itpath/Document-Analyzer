import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from './ui/Dialog';
import { Link2, Loader2, CheckCircle2, FileText, RefreshCw, XCircle, CloudOff, Kanban, ArrowLeft, ChevronDown, Settings } from 'lucide-react';
import { apiUrl, authHeaders } from '../lib/api';
import JiraAssistantView from './JiraAssistantView';
import GlobalJiraSettingsView from './GlobalJiraSettingsView';

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
  const [isJiraConnected, setIsJiraConnected] = useState<boolean | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{message: string, isError: boolean} | null>(null);

  const [activeConnector, setActiveConnector] = useState<string | null>(null);

  const fetchJiraStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/jira/status'), { headers: authHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        setIsJiraConnected(data.connected);
      } else {
        setIsJiraConnected(false);
      }
    } catch (err) {
      setIsJiraConnected(false);
    }
  };

  const fetchWorkspaceDocs = async () => {
    try {
      const url = projectId
        ? apiUrl(`/documents?project_id=${projectId}`)
        : apiUrl('/documents');
      const res = await fetch(url, {
        headers: authHeaders(token)
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
      const res = await fetch(apiUrl('/documents/google/list'), {
        headers: authHeaders(token)
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
    fetchJiraStatus();
  }, [token, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch(apiUrl('/auth/google/login'), {
        headers: authHeaders(token)
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
      const res = await fetch(apiUrl('/auth/google/disconnect'), {
        method: 'DELETE',
        headers: authHeaders(token)
      });
      if (res.ok) {
        setIsConnected(false);
        setGoogleDocs([]);
        setDocsError("Not connected to Google. Please connect your account above.");
        setActiveConnector(null);
      } else {
        await dialog.alert({ title: 'Disconnect Failed', message: 'Failed to disconnect Google account', variant: 'danger' });
      }
    } catch (err) {
      await dialog.alert({ title: 'Network Error', message: 'Network error trying to reach the server.', variant: 'danger' });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleConnectJira = async () => {
    try {
      const res = await fetch(apiUrl('/auth/jira/login'), {
        headers: authHeaders(token)
      });
      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        await dialog.alert({ title: 'Connection Failed', message: data.detail || 'Failed to initialize Jira Login', variant: 'danger' });
      }
    } catch (err) {
      console.error("Login redirect failed:", err);
      await dialog.alert({ title: 'Network Error', message: 'Network error trying to reach the server.', variant: 'danger' });
    }
  };

  const handleDisconnectJira = async () => {
    const confirmed = await dialog.confirm({
      title: 'Disconnect Jira Account',
      message: 'Are you sure you want to disconnect your Jira account?',
      confirmLabel: 'Disconnect',
      variant: 'danger'
    });
    if (!confirmed) return;
    
    setIsDisconnecting(true);
    try {
      const res = await fetch(apiUrl('/auth/jira/disconnect'), {
        method: 'DELETE',
        headers: authHeaders(token)
      });
      if (res.ok) {
        setIsJiraConnected(false);
      } else {
        await dialog.alert({ title: 'Disconnect Failed', message: 'Failed to disconnect Jira account', variant: 'danger' });
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

      const res = await fetch(apiUrl('/documents/google'), {
        method: 'POST',
        headers: authHeaders(token),
        body: formData
      });

      const data = await res.json();
      
      if (!res.ok) {
        setSyncStatus({ message: data.detail || "Failed to sync document", isError: true });
        return;
      }

      await fetchWorkspaceDocs();
      if (onSyncComplete) onSyncComplete();
      
      setSyncStatus({ message: "Successfully synced document!", isError: false });
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
      const res = await fetch(apiUrl(`/documents/${workspaceDoc.id}`), {
        method: 'DELETE',
        headers: authHeaders(token)
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

  // Jira Assistant View
  if (activeConnector === 'jira') {
    return <JiraAssistantView onBack={() => setActiveConnector(null)} projectId={projectId} />;
  }

  // Google Docs View (Detailed list)
  if (activeConnector === 'google') {
    return (
      <div className="h-full flex flex-col bg-background relative z-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveConnector(null)}
              className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
              title="Back to Connectors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center p-2 flex-shrink-0 border border-blue-100">
              <svg viewBox="0 0 48 48" className="w-full h-full">
                <path fill="#4285F4" d="M31 4H11C8.79 4 7.02 5.79 7.02 8L7 40c0 2.21 1.77 4 3.98 4H37c2.21 0 4-1.79 4-4V14L31 4z" />
                <path fill="#1A73E8" d="M30 4L41 15H30V4z" />
                <path fill="#E8EAED" d="M15 23h18v2H15v-2zm0 6h18v2H15v-2zm0 6h12v2H15v-2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-black text-lg">Google Docs</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Select documents to sync to your workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={handleDisconnectGoogle}
              disabled={isDisconnecting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
            >
              <CloudOff size={14} />
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
            <button 
              onClick={fetchGoogleDocsList}
              disabled={isLoadingDocs}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-background border border-border hover:bg-muted rounded-xl text-foreground font-bold text-xs transition-all shadow-sm"
            >
              <RefreshCw size={14} className={isLoadingDocs ? "animate-spin" : ""} />
              Refresh List
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            {syncStatus && (
              <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 shadow-lg transform transition-all animate-in slide-in-from-top-4 ${
                syncStatus.isError ? 'bg-red-500/10 border border-red-500/20 text-red-500' : 'bg-green-500/10 border border-green-500/20 text-green-600'
              }`}>
                {syncStatus.isError ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
                <p className="font-bold text-sm">{syncStatus.message}</p>
              </div>
            )}

            {isLoadingDocs ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 size={32} className="animate-spin mb-4 text-accent" />
                <p className="font-bold text-sm">Loading your Google Docs...</p>
              </div>
            ) : docsError ? (
              <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl bg-card">
                <p className="text-muted-foreground font-bold text-sm">{docsError}</p>
              </div>
            ) : googleDocs.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl bg-card/50">
                <FileText size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-xl font-black">No documents found</p>
                <p className="text-sm text-muted-foreground mt-2">Make sure you have documents in your connected Google Drive.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {googleDocs.map((doc) => {
                  const isSynced = workspaceDocs.some(w => w.google_doc_id === doc.id);
                  const isSyncing = syncingDocId === doc.id;
                  
                  return (
                    <div 
                      key={doc.id} 
                      className={`group flex flex-col justify-between p-5 rounded-2xl transition-all duration-300 border ${
                        isSynced 
                          ? 'bg-accent/5 border-accent/20 shadow-sm' 
                          : 'bg-card border-border/50 hover:border-accent/40 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start gap-4 mb-4 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSynced ? 'bg-accent/10 text-accent' : 'bg-blue-50 text-blue-500'
                        }`}>
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <p className="font-bold text-sm line-clamp-2 leading-tight" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1.5 truncate font-medium">
                            Modified: {new Date(doc.modifiedTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                        <div>
                          {isSynced && (
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-accent uppercase tracking-wider">
                              <CheckCircle2 size={12} /> Synced
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => isSynced ? unsyncDocument(doc) : syncDocument(doc)}
                          disabled={isSyncing}
                          className={`min-w-[80px] px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
        </div>
      </div>
    );
  }

  // Main Connectors Hub View
  return (
    <div className="h-full flex flex-col bg-background relative z-0 overflow-y-auto custom-scrollbar">
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-accent/10 to-transparent pointer-events-none -z-10" />
      
      <div className="max-w-4xl mx-auto w-full p-8 pt-12 flex-1">
        <h1 className="text-4xl font-black mb-2 tracking-tight">Connectors</h1>
        <p className="text-muted-foreground mb-12 text-lg">Connect external apps to bring your knowledge base together.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Google Docs Card */}
          <div 
            onClick={() => isConnected === true && setActiveConnector('google')}
            className={`flex flex-col border rounded-3xl p-6 transition-all duration-300 bg-card ${
              isConnected === true 
                ? 'cursor-pointer hover:border-accent/40 hover:shadow-lg hover:-translate-y-1' 
                : 'border-border/50'
            }`}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center p-2.5 flex-shrink-0 border border-blue-100">
                <svg viewBox="0 0 48 48" className="w-full h-full">
                  <path fill="#4285F4" d="M31 4H11C8.79 4 7.02 5.79 7.02 8L7 40c0 2.21 1.77 4 3.98 4H37c2.21 0 4-1.79 4-4V14L31 4z" />
                  <path fill="#1A73E8" d="M30 4L41 15H30V4z" />
                  <path fill="#E8EAED" d="M15 23h18v2H15v-2zm0 6h18v2H15v-2zm0 6h12v2H15v-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-black text-xl">Google Docs</h3>
                <div className="flex items-center gap-2 mt-1">
                  {isConnected === true ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-1 bg-blue-500/10 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                      Read & Write
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6 flex-1">
              Connect your Google account to securely sync documents to your AI knowledge base.
            </p>
            
            <div className="mt-auto">
              {isConnected === false ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleConnectGoogle(); }}
                  className="w-full px-4 py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/30 hover:shadow-accent/50 transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Link2 size={16} /> Connect to Google Docs
                </button>
              ) : isConnected === true ? (
                <button className="w-full px-4 py-3 bg-accent/10 text-accent font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2">
                  View Documents <ChevronDown size={16} className="-rotate-90" />
                </button>
              ) : (
                <button disabled className="w-full px-4 py-3 bg-muted text-muted-foreground font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Checking Status...
                </button>
              )}
            </div>
          </div>

          {/* Jira Card */}
          <div className={`flex flex-col border rounded-3xl p-6 transition-all duration-300 bg-card ${isJiraConnected ? 'border-accent/40 shadow-lg' : 'border-border/50 hover:border-border'}`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-[#0052CC] rounded-2xl shadow-sm flex items-center justify-center p-2.5 flex-shrink-0 border border-blue-800 text-white">
                <Kanban size={28} />
              </div>
              <div>
                <h3 className="font-black text-xl">Jira</h3>
                <div className="flex items-center gap-2 mt-1">
                  {isJiraConnected === true ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-1 bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider rounded-md">
                      Read & Write
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6 flex-1">
              Connect Jira to track tasks, manage sprints, and sync tickets directly into the AI's context window.
            </p>
            
            <div className="mt-auto">
              {isJiraConnected === false ? (
                <button
                  onClick={(e) => { e.stopPropagation(); handleConnectJira(); }}
                  className="w-full px-4 py-3 bg-muted hover:bg-accent hover:text-white hover:shadow-lg hover:shadow-accent/30 transition-all text-foreground font-bold rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  <Link2 size={16} /> Connect to Jira
                </button>
              ) : isJiraConnected === true ? (
                <div className="flex gap-2">
                  <button onClick={handleDisconnectJira} className="flex-1 px-4 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2">
                    Disconnect
                  </button>
                  <button onClick={() => setActiveConnector('jira')} className="flex-[2] px-4 py-3 bg-accent text-white shadow-lg shadow-accent/30 hover:shadow-accent/50 font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2">
                    Create Ticket <ChevronDown size={16} className="-rotate-90" />
                  </button>
                </div>
              ) : (
                <button disabled className="w-full px-4 py-3 bg-muted text-muted-foreground font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Checking Status...
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-8">
          <GlobalJiraSettingsView />
        </div>
      </div>
    </div>
  );
};

export default IntegrationsView;
