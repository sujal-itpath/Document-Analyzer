'use client';

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import HomeView from '../../components/HomeView';
import ChatInterface from '../../components/ChatInterface';
import DocumentViewer from '../../components/DocumentViewer';
import IntegrationsView from '../../components/IntegrationsView';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../components/ui/Dialog';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import TestCasesPanel, { TestCaseResponseData } from '../../components/TestCasesPanel';
import { apiUrl, authHeaders } from '../../lib/api';
import type { DocumentItem } from '../../lib/types';

type ViewType = 'home' | 'doc-select' | 'chat' | 'integrations';
type MessageItem = { role: 'user' | 'agent'; content: string };
type SessionMessagesResponse = {
  messages: Array<{ role: 'user' | 'agent'; content: string; timestamp: string }>;
  document_ids: number[];
  documents: DocumentItem[];
};
type UploadResponse = {
  filenames: string[];
};
type SidebarSession = {
  id: string;
  title: string;
  created_at: string;
};

export default function Dashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<ViewType>('home');
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
  const { isAuthenticated, token: authToken, loading, logout, activeProject } = useAuth();
  const router = useRouter();

  const [selectedDocs, setSelectedDocs] = useState<DocumentItem[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [allDocs, setAllDocs] = useState<DocumentItem[]>([]);
  const [sidebarSessions, setSidebarSessions] = useState<SidebarSession[]>([]);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [draftSessionTitle, setDraftSessionTitle] = useState<string | null>(null);
  const [optimisticSession, setOptimisticSession] = useState<SidebarSession | null>(null);
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [quotedText, setQuotedText] = useState<string | undefined>(undefined);
  const [warningMessage, setWarningMessage] = useState<string | undefined>(undefined);
  const currentSessionIdRef = useRef<string | undefined>(undefined);
  const dialog = useDialog();

  // Split Pane State
  const [isSplitView, setIsSplitView] = useState(false);
  const [splitViewContent, setSplitViewContent] = useState<'document' | 'testcases'>('document');
  const [splitWidth, setSplitWidth] = useState(50);
  const [activeDocumentId, setActiveDocumentId] = useState<number | undefined>(undefined);
  const [testCasesData, setTestCasesData] = useState<TestCaseResponseData | null>(null);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    const handleMouseMove = (ev: MouseEvent) => {
      const mainElement = document.getElementById('main-chat-container');
      if (mainElement) {
        const rect = mainElement.getBoundingClientRect();
        const newWidth = ((ev.clientX - rect.left) / rect.width) * 100;
        setSplitWidth(Math.min(Math.max(newWidth, 20), 80));
      }
    };
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('connector')) {
        setActiveView('integrations');
        url.searchParams.delete('connector');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  useEffect(() => {
    const storageKey = activeProject ? `current_session_id_${activeProject.id}` : 'current_session_id';
    if (currentSessionId) {
      localStorage.setItem(storageKey, currentSessionId);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [currentSessionId, activeProject]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const fetchAllDocs = async (): Promise<DocumentItem[]> => {
    if (!authToken) return [];
    try {
      const url = activeProject ? `http://localhost:8000/documents?project_id=${activeProject.id}` : 'http://localhost:8000/documents';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        logout();
        return [];
      }
      if (!res.ok) return [];
      const docs: DocumentItem[] = await res.json();
      setAllDocs(docs);
      return docs;
    } catch (err) {
      console.error('Failed to fetch documents', err);
      return [];
    }
  };

  const fetchSidebarSessions = async () => {
    if (!authToken) return;
    try {
      const url = activeProject ? `http://localhost:8000/sessions?project_id=${activeProject.id}` : 'http://localhost:8000/sessions';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) return;
      const sessions: SidebarSession[] = await res.json();
      setSidebarSessions(sessions);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    }
  };

  useEffect(() => {
    void fetchAllDocs();
    void fetchSidebarSessions();
  }, [authToken, activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewChat = () => {
    setCurrentSessionId(undefined);
    setDraftSessionId(null);
    setDraftSessionTitle(null);
    setOptimisticSession(null);
    const storageKey = activeProject ? `current_session_id_${activeProject.id}` : 'current_session_id';
    localStorage.removeItem(storageKey);
    setMessages([]);
    setSelectedDocs([]);
    setInputText('');
    setQuotedText(undefined);
    setIsSplitView(false);
    setSplitViewContent('document');
    setTestCasesData(null);
    setActiveDocumentId(undefined);
    setActiveView('doc-select');
  };

  const handleOpenChat = (docs: DocumentItem[]) => {
    setSelectedDocs(docs);
    setMessages([]);
    setInputText('');
    setQuotedText(undefined);
    setCurrentSessionId(undefined);
    setDraftSessionId(`draft-${Date.now()}`);
    setDraftSessionTitle(
      docs.length === 1
        ? docs[0].filename
        : `${docs[0]?.filename ?? 'New chat'} +${Math.max(docs.length - 1, 0)}`
    );
    setOptimisticSession(null);
    const storageKey = activeProject ? `current_session_id_${activeProject.id}` : 'current_session_id';
    localStorage.removeItem(storageKey);
    setActiveView('chat');
  };

  const handleSessionSelect = async (sessionId: string) => {
    if (!authToken) return;
    setIsThinking(true);
    try {
      const res = await fetch(apiUrl(`/sessions/${sessionId}/messages`), {
        headers: authHeaders(authToken),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch session');
      }

      const data: SessionMessagesResponse = await res.json();
      setCurrentSessionId(sessionId);
      currentSessionIdRef.current = sessionId;
      setDraftSessionId(null);
      setDraftSessionTitle(null);
      if (optimisticSession?.id === sessionId) {
        setOptimisticSession(null);
      }
      setMessages(data.messages.map(message => ({ role: message.role, content: message.content })));
      setSelectedDocs(data.documents);
      setInputText('');
      setQuotedText(undefined);
      setIsSplitView(false);
      setSplitViewContent('document');
      setTestCasesData(null);
      setActiveDocumentId(undefined);
      setActiveView('chat');
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSessionDelete = async (sessionId: string) => {
    if (!authToken) return;
    try {
      const res = await fetch(apiUrl(`/sessions/${sessionId}`), {
        method: 'DELETE',
        headers: authHeaders(authToken),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error('Failed to delete session');
      
      setSidebarSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // If the currently viewed session is deleted, go back to a clean state
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Error deleting session', err);
    }
  };

  const handleSessionRename = async (sessionId: string, newTitle: string) => {
    if (!authToken || !newTitle.trim()) return;
    try {
      const res = await fetch(apiUrl(`/sessions/${sessionId}`), {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeaders(authToken),
        },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error('Failed to rename session');
      
      const updatedSession = await res.json();
      setSidebarSessions(prev => 
        prev.map(s => s.id === sessionId ? { ...s, title: updatedSession.title } : s)
      );
    } catch (err) {
      console.error('Error renaming session', err);
    }
  };

  useEffect(() => {
    const storageKey = activeProject ? `current_session_id_${activeProject.id}` : 'current_session_id';
    const savedSessionId = localStorage.getItem(storageKey);
    if (!authToken || loading || currentSessionId) {
      return;
    }
    if (savedSessionId) {
      void handleSessionSelect(savedSessionId);
    }
  }, [authToken, loading, currentSessionId, activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDocumentDeleted = (docId: number) => {
    const deletedDoc = allDocs.find(d => d.id === docId);
    if (deletedDoc) {
      if (selectedDocs.some(d => d.id === docId)) {
        setWarningMessage(`Document "${deletedDoc.filename}" was removed from your workspace. It will no longer be referenced.`);
        setSelectedDocs(prev => prev.map(d => d.id === docId ? { ...d, isDeleted: true } : d));
      }
      setAllDocs(prev => prev.map(d => d.id === docId ? { ...d, isDeleted: true } : d));
    }
  };

  const persistSessionDocuments = async (sessionId: string, docs: DocumentItem[]) => {
    if (!authToken) return;
    const uniqueIds = Array.from(new Set(docs.map(doc => doc.id)));
    const res = await fetch(apiUrl(`/sessions/${sessionId}/documents`), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(authToken),
      },
      body: JSON.stringify({ document_ids: uniqueIds }),
    });
    if (res.status === 401) {
      logout();
    }
  };

  const handleUploadDocuments = async (files: FileList) => {
    if (!authToken || files.length === 0) return;

    setIsUploadingDocuments(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('overwrite', 'false');

    try {
      const res = await fetch(apiUrl('/upload'), {
        method: 'POST',
        headers: authHeaders(authToken),
        body: formData,
      });

      if (res.status === 401) {
        logout();
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || 'Upload failed');
      }

      const uploadData: UploadResponse = await res.json();
      const latestDocs = await fetchAllDocs();
      const uploadedDocs = latestDocs.filter(doc => uploadData.filenames.includes(doc.filename));
      if (uploadedDocs.length === 0) return;

      setSelectedDocs(prev => {
        const existingIds = new Set(prev.map(doc => doc.id));
        const merged = [...prev, ...uploadedDocs.filter(doc => !existingIds.has(doc.id))];
        if (currentSessionIdRef.current) {
          void persistSessionDocuments(currentSessionIdRef.current, merged);
        }
        return merged;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      await dialog.alert({ title: 'Upload Failed', message, variant: 'danger' });
    } finally {
      setIsUploadingDocuments(false);
    }
  };

  const handleGenerateTestCases = async (testType: string) => {
    if (!authToken) return;
    
    const userMessage = ['Manual', 'API', 'Smoke', 'Regression', 'All'].includes(testType) 
      ? `I want to generate ${testType} test cases.` 
      : testType;
    
    // Instead of directly calling the backend, we send a message to the LangGraph agent
    // which will start the conversational workflow and eventually trigger [TEST_CASES_GENERATED: filename].
    await handleSendMessage(undefined, userMessage);
  };

  const handleTestCasesGenerated = async (filename: string) => {
    if (!authToken) return;
    try {
      const res = await fetch(`http://localhost:8000/test-cases/history?filename=${encodeURIComponent(filename)}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch test cases history');

      const data = await res.json();
      if (data.data && data.data.length > 0) {
        setTestCasesData(data.data[0]); // Get the most recent run
        setSplitViewContent('testcases');
        setIsSplitView(true);
      }
    } catch (err) {
      console.error("Failed to load generated test cases:", err);
      // Wait for 1 second and retry once, sometimes history takes a moment to persist
      setTimeout(async () => {
        try {
          const res = await fetch(`http://localhost:8000/test-cases/history?filename=${encodeURIComponent(filename)}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const data = await res.json();
          if (data.data && data.data.length > 0) {
            setTestCasesData(data.data[0]);
            setSplitViewContent('testcases');
            setIsSplitView(true);
          }
        } catch (e) {}
      }, 1500);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, messageOverride?: string) => {
    e?.preventDefault();
    const rawInput = (messageOverride || inputText).trim();
    if (!rawInput && !quotedText) return;
    if (isThinking) return;

    setInputText('');
    setQuotedText(undefined);
    
    const userMessage = quotedText ? `[QUOTED: "${quotedText}"]\n\n${rawInput}` : rawInput;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsThinking(true);

    const requestSessionId = currentSessionIdRef.current;
    const requestDocumentIds = selectedDocs.filter(d => !d.isDeleted).map(doc => doc.id);

    try {
      const res = await fetch(apiUrl('/ask'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(authToken),
        },
        body: JSON.stringify({
          question: userMessage,
          thread_id: requestSessionId,
          document_ids: requestSessionId ? [] : requestDocumentIds,
          project_id: activeProject?.id,
        }),
      });

      if (res.status === 401) {
        logout();
        return;
      }

      if (!res.ok) throw new Error('Failed to get response');

      const returnedSessionId = res.headers.get('X-Session-ID');
      if (returnedSessionId && !requestSessionId) {
        setCurrentSessionId(returnedSessionId);
        currentSessionIdRef.current = returnedSessionId;
        setDraftSessionId(null);
        setDraftSessionTitle(null);
        const createdSession = {
          id: returnedSessionId,
          title: userMessage.length > 30 ? `${userMessage.slice(0, 30)}...` : userMessage,
          created_at: new Date().toISOString(),
        };
        setOptimisticSession(createdSession);
        setSidebarSessions(prev => {
          if (prev.some(session => session.id === returnedSessionId)) {
            return prev;
          }
          return [createdSession, ...prev];
        });
        void fetchSidebarSessions();
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let started = false;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          if (!started && accumulated.length > 0) {
            started = true;
            setIsThinking(false);
            setMessages(prev => [...prev, { role: 'agent', content: accumulated }]);
          } else if (started) {
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { role: 'agent', content: accumulated };
              return next;
            });
          }
        }
      }
    } catch {
      setIsThinking(false);
      setMessages(prev => [...prev, { role: 'agent', content: 'Something went wrong. Please try again.' }]);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeView={activeView}
        setActiveView={setActiveView}
        currentSessionId={currentSessionId}
        sessions={sidebarSessions}
        draftSessionId={draftSessionId}
        draftSessionTitle={draftSessionTitle}
        optimisticSession={optimisticSession}
        onSessionSelect={handleSessionSelect}
        onSessionDelete={handleSessionDelete}
        onSessionRename={handleSessionRename}
        onNewChat={handleNewChat}
      />

      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {activeView === 'home' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-card/50 flex-shrink-0">
              <button
                onClick={() => router.push('/workspaces?step=projects')}
                className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
                title="Back to Projects"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="font-black text-lg">Documents</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Manage and view your workspace documents
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <HomeView
                mode="manage"
                projectId={activeProject?.id}
                onSelectDocuments={setSelectedDocs}
                onOpenChat={handleOpenChat}
                onDocumentDeleted={handleDocumentDeleted}
              />
            </div>
          </div>
        )}

        {activeView === 'integrations' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-card/50 flex-shrink-0">
              <button
                onClick={() => setActiveView('home')}
                className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
                title="Back to Documents"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="font-black text-lg">Connectors</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Connect third-party apps to sync documents
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <IntegrationsView 
                projectId={activeProject?.id}
                onSyncComplete={async () => {
                  const latestDocs = await fetchAllDocs();
                  setSelectedDocs(prev => prev.filter(doc => latestDocs.some(l => l.id === doc.id)));
                }}
              />
            </div>
          </div>
        )}

        {activeView === 'doc-select' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3 bg-card/50 flex-shrink-0">
              <button
                onClick={() => setActiveView('home')}
                className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="font-black text-lg">New Chat - Select Documents</h2>
                <p className="text-xs text-muted-foreground font-medium">
                  Choose one or more documents to include in this conversation
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <HomeView
                mode="select"
                onSelectDocuments={setSelectedDocs}
                onOpenChat={handleOpenChat}
              />
            </div>
          </div>
        )}

        {activeView === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedDocs.length > 0 && (
              <div className="px-6 py-2.5 border-b border-border bg-card/40 flex items-center gap-3 flex-wrap flex-shrink-0">
                <button
                  onClick={() => setActiveView('home')}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground mr-1"
                  title="Back to Documents"
                >
                  <ArrowLeft size={16} />
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                  Context
                </span>
                {selectedDocs.map(doc => (
                  <span
                    key={doc.id}
                    className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                      doc.isDeleted 
                        ? 'bg-muted/40 border-muted text-muted-foreground line-through opacity-70' 
                        : 'bg-accent/10 border-accent/20 text-accent'
                    }`}
                  >
                    {doc.filename}
                    {doc.isDeleted && <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 not-italic no-underline">Deleted</span>}
                  </span>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isSplitView && splitViewContent === 'document') setIsSplitView(false);
                      else { setIsSplitView(true); setSplitViewContent('document'); }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isSplitView && splitViewContent === 'document' ? 'bg-accent text-white shadow-lg' : 'bg-accent/10 text-accent hover:bg-accent/20'
                    }`}
                  >
                    {isSplitView && splitViewContent === 'document' ? 'Close Docs' : 'View Docs'}
                  </button>
                  <button
                    onClick={() => {
                      if (isSplitView && splitViewContent === 'testcases') setIsSplitView(false);
                      else { setIsSplitView(true); setSplitViewContent('testcases'); }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isSplitView && splitViewContent === 'testcases' ? 'bg-accent text-white shadow-lg' : 'bg-accent/10 text-accent hover:bg-accent/20'
                    }`}
                  >
                    {isSplitView && splitViewContent === 'testcases' ? 'Close Tests' : 'View Tests'}
                  </button>
                  <label className={`cursor-pointer text-[10px] font-black uppercase tracking-widest transition-colors ${isUploadingDocuments ? 'text-muted-foreground/50' : 'text-muted-foreground hover:text-accent'}`}>
                    <input 
                      type="file" 
                      className="hidden" 
                      multiple 
                      accept=".pdf,.txt,.docx,.csv,.md" 
                      disabled={isUploadingDocuments}
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          handleUploadDocuments(files);
                        }
                        e.target.value = '';
                      }} 
                    />
                    Add Doc
                  </label>
                </div>
              </div>
            )}

            <div id="main-chat-container" className="flex-1 flex overflow-hidden">
              {isSplitView && (
                <>
                  <div style={{ width: `${splitWidth}%` }} className="h-full border-r border-border overflow-hidden bg-background">
                    {splitViewContent === 'document' ? (
                      <DocumentViewer
                        documents={selectedDocs}
                        activeDocumentId={activeDocumentId}
                        onDocumentChange={setActiveDocumentId}
                        onQuoteSelect={setQuotedText}
                      />
                    ) : (
                      <TestCasesPanel 
                        documents={selectedDocs}
                        testCasesData={testCasesData}
                        onGenerateTestCases={undefined}
                      />
                    )}
                  </div>
                  <div 
                    onMouseDown={handleDividerMouseDown}
                    className="w-1.5 hover:w-2 bg-transparent hover:bg-accent/50 cursor-col-resize transition-all shrink-0 z-10 -ml-0.5" 
                  />
                </>
              )}
              
              <div style={{ width: isSplitView ? `${100 - splitWidth}%` : '100%' }} className="h-full flex flex-col min-w-0">
                <ChatInterface
              messages={messages}
              inputText={inputText}
              setInputText={setInputText}
              isThinking={isThinking}
              onSendMessage={handleSendMessage}
              onClearChat={() => setMessages([])}
              mode={selectedDocs.length > 1 ? 'multi' : 'single'}
              availableDocuments={allDocs}
              selectedDocs={selectedDocs}
              onUploadDocuments={handleUploadDocuments}
              isUploadingDocuments={isUploadingDocuments}
              quotedText={quotedText}
              onClearQuote={() => setQuotedText(undefined)}
              warningMessage={warningMessage}
              onGenerateTestCases={handleGenerateTestCases}
              onTestCasesGenerated={handleTestCasesGenerated}
              onDocumentSelect={(doc) => {
                setSelectedDocs(prev => {
                  if (prev.find(existing => existing.id === doc.id)) {
                    return prev;
                  }
                  const merged = [...prev, doc];
                  if (currentSessionIdRef.current) {
                    void persistSessionDocuments(currentSessionIdRef.current, merged);
                  }
                  return merged;
                });
              }}
            />
          </div>
        </div>
        </div>
        )}
      </main>
    </div>
  );
}
