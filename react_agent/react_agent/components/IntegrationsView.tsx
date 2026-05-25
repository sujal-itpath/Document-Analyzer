import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link2, Loader2, CheckCircle2, FileText, RefreshCw, XCircle, CloudOff } from 'lucide-react';

interface IntegrationsViewProps {
  onSyncComplete?: () => void;
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

const IntegrationsView: React.FC<IntegrationsViewProps> = ({ onSyncComplete }) => {
  const { token, logout } = useAuth();
  const [googleDocs, setGoogleDocs] = useState<GoogleDoc[]>([]);
  const [workspaceDocs, setWorkspaceDocs] = useState<WorkspaceDoc[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  // Track which document is currently being synced/unsynced
  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<{message: string, isError: boolean} | null>(null);

  const fetchWorkspaceDocs = async () => {
    try {
      const res = await fetch('http://localhost:8000/documents', {
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
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectGoogle = async () => {
    try {
      const res = await fetch('http://localhost:8000/auth/google/login', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.detail || "Failed to initialize Google Login");
      }
    } catch (err) {
      console.error("Login redirect failed:", err);
      alert("Network error trying to reach the server.");
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm("Are you sure you want to disconnect your Google account?")) return;
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
        alert("Failed to disconnect Google account");
      }
    } catch (err) {
      alert("Network error trying to reach the server.");
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

    if (!confirm(`Are you sure you want to unsync "${doc.name}"? This removes it from your AI knowledge base.`)) return;

    setSyncingDocId(doc.id);
    try {
      const res = await fetch(`http://localhost:8000/documents/${workspaceDoc.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Failed to unsync document");
        return;
      }

      await fetchWorkspaceDocs();
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      alert("Network error during unsync.");
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

        <div className="grid grid-cols-1 mb-10">
          {/* Google Docs Auth Card - Only show if NOT connected */}
          {isConnected === false && (
            <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl flex flex-col items-start relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-opacity group-hover:opacity-100 opacity-50" />
              
              <div className="flex items-center gap-5 mb-6 z-10">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center p-3 flex-shrink-0 border border-blue-100">
                  <svg viewBox="0 0 48 48" className="w-full h-full">
                    <path fill="#4285F4" d="M31 4H11C8.79 4 7.02 5.79 7.02 8L7 40c0 2.21 1.77 4 3.98 4H37c2.21 0 4-1.79 4-4V14L31 4z" />
                    <path fill="#1A73E8" d="M30 4L41 15H30V4z" />
                    <path fill="#E8EAED" d="M15 23h18v2H15v-2zm0 6h18v2H15v-2zm0 6h12v2H15v-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-black text-2xl">Google Docs</h3>
                  <span className="inline-block mt-1 px-3 py-1 bg-blue-500/10 text-blue-600 text-[11px] font-bold uppercase tracking-wider rounded-full">Read & Write Access</span>
                </div>
              </div>
              
              <p className="text-base text-muted-foreground mb-8 flex-1 leading-relaxed max-w-xl z-10">
                Connect your Google account to securely sync documents to your AI knowledge base. 
                The AI can also be granted permission to replace specific text directly inside your docs.
              </p>
              
              <button
                onClick={handleConnectGoogle}
                className="px-8 py-3.5 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/30 hover:shadow-accent/50 hover:-translate-y-0.5 active:translate-y-0 transition-all z-10 text-lg"
              >
                Connect to Google
              </button>
            </div>
          )}
        </div>

        {isConnected && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-end justify-between mb-8 border-b border-border/50 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-blue-500/30">
                  <FileText size={28} />
                </div>
                <div>
                  <h3 className="font-black text-2xl tracking-tight">Your Google Docs</h3>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Select documents to sync to your workspace</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleDisconnectGoogle}
                  disabled={isDisconnecting}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-all disabled:opacity-50"
                >
                  <CloudOff size={16} />
                  {isDisconnecting ? 'Disconnecting...' : 'Disconnect Account'}
                </button>
                <button 
                  onClick={fetchGoogleDocsList}
                  disabled={isLoadingDocs}
                  className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border/50 hover:bg-muted/50 hover:border-border rounded-xl text-foreground font-bold text-sm transition-all shadow-sm"
                >
                  <RefreshCw size={16} className={isLoadingDocs ? "animate-spin" : ""} />
                  Refresh List
                </button>
              </div>
            </div>

            {isLoadingDocs ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <Loader2 size={32} className="animate-spin mb-4 text-accent" />
                <p className="font-medium">Loading your Google Docs...</p>
              </div>
            ) : docsError ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-3xl">
                <p className="text-muted-foreground font-medium">{docsError}</p>
              </div>
            ) : googleDocs.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl bg-card/20">
                <FileText size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-bold">No documents found</p>
                <p className="text-sm text-muted-foreground mt-2">Make sure you have documents in your connected Google Drive.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {googleDocs.map((doc) => {
                  const isSynced = workspaceDocs.some(w => w.google_doc_id === doc.id);
                  const isSyncing = syncingDocId === doc.id;
                  
                  return (
                    <div 
                      key={doc.id} 
                      className={`group flex items-center justify-between p-5 rounded-2xl transition-all duration-300 border ${
                        isSynced 
                          ? 'bg-accent/5 border-accent/20 shadow-sm' 
                          : 'bg-card border-border/50 hover:border-accent/30 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0 mr-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSynced ? 'bg-accent/10 text-accent' : 'bg-blue-50 text-blue-500'
                        }`}>
                          <FileText size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            Modified: {new Date(doc.modifiedTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 flex items-center gap-3">
                        {isSynced && (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 size={14} /> Synced
                          </span>
                        )}
                        
                        <button
                          onClick={() => isSynced ? unsyncDocument(doc) : syncDocument(doc)}
                          disabled={isSyncing}
                          className={`min-w-[80px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                            isSyncing
                              ? 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
                              : isSynced
                                ? 'bg-background hover:bg-red-500/10 hover:text-red-500 border border-border hover:border-red-500/20 text-muted-foreground'
                                : 'bg-accent text-white shadow-md shadow-accent/20 hover:shadow-accent/40 hover:-translate-y-0.5'
                          }`}
                        >
                          {isSyncing ? (
                            <><Loader2 size={14} className="animate-spin" /> ...</>
                          ) : isSynced ? (
                            'Unsync'
                          ) : (
                            <><Link2 size={14} /> Sync</>
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
  );
};

export default IntegrationsView;
