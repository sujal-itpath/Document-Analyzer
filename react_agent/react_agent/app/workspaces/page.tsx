'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Bot, Folder, Plus, Trash2, Edit2, ArrowLeft, 
  LogOut, Loader2, Check, X, ChevronRight, FileText 
} from 'lucide-react';

type WorkspaceItem = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

type ProjectItem = {
  id: number;
  name: string;
  description: string | null;
  workspace_id: number;
  created_at: string;
};

export default function WorkspacesPage() {
  const { token, logout, selectWorkspace, selectProject, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [selectedWorkspace, setSelectedWorkspaceState] = useState<WorkspaceItem | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [viewStep, setViewStep] = useState<'workspaces' | 'projects'>('workspaces');
  
  // Loaders
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms State
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');

  // Editing state
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<number | null>(null);
  const [editWsName, setEditWsName] = useState('');
  const [editWsDesc, setEditWsDesc] = useState('');

  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editProjName, setEditProjName] = useState('');
  const [editProjDesc, setEditProjDesc] = useState('');

  // Deleting confirmation
  const [deletingWorkspace, setDeletingWorkspace] = useState<WorkspaceItem | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectItem | null>(null);

  // Protect route
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  const fetchWorkspaces = async () => {
    if (!token) return;
    setIsLoadingWorkspaces(true);
    try {
      const res = await fetch('http://localhost:8000/workspaces', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
      }
    } catch (e) {
      console.error('Failed to fetch workspaces', e);
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  const fetchProjects = async (workspaceId: number) => {
    if (!token) return;
    setIsLoadingProjects(true);
    try {
      const res = await fetch(`http://localhost:8000/workspaces/${workspaceId}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (e) {
      console.error('Failed to fetch projects', e);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (token) {
      void fetchWorkspaces();
    }
  }, [token]);

  useEffect(() => {
    if (typeof window !== 'undefined' && token) {
      const url = new URL(window.location.href);
      const step = url.searchParams.get('step');
      if (step === 'projects') {
        const savedWorkspace = localStorage.getItem('active_workspace');
        if (savedWorkspace) {
          try {
            const parsed = JSON.parse(savedWorkspace);
            setSelectedWorkspaceState(parsed);
            setViewStep('projects');
            void fetchProjects(parsed.id);
          } catch (e) {
            console.error('Failed to parse active_workspace from localStorage', e);
          }
        }
      } else if (step === 'workspaces') {
        setSelectedWorkspaceState(null);
        setViewStep('workspaces');
      }
    }
  }, [token]);

  // Workspace CRUD
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || !token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:8000/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: wsName.trim(), description: wsDesc.trim() })
      });
      if (res.ok) {
        setWsName('');
        setWsDesc('');
        setShowCreateWorkspace(false);
        await fetchWorkspaces();
      }
    } catch (e) {
      console.error('Failed to create workspace', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateWorkspace = async (id: number) => {
    if (!editWsName.trim() || !token) return;
    try {
      const res = await fetch(`http://localhost:8000/workspaces/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: editWsName.trim(), description: editWsDesc.trim() })
      });
      if (res.ok) {
        setEditingWorkspaceId(null);
        await fetchWorkspaces();
      }
    } catch (e) {
      console.error('Failed to update workspace', e);
    }
  };

  const handleDeleteWorkspace = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:8000/workspaces/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 204 || res.ok) {
        setDeletingWorkspace(null);
        await fetchWorkspaces();
      }
    } catch (e) {
      console.error('Failed to delete workspace', e);
    }
  };

  // Project CRUD
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim() || !selectedWorkspace || !token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`http://localhost:8000/workspaces/${selectedWorkspace.id}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: projName.trim(), description: projDesc.trim() })
      });
      if (res.ok) {
        setProjName('');
        setProjDesc('');
        setShowCreateProject(false);
        await fetchProjects(selectedWorkspace.id);
      }
    } catch (e) {
      console.error('Failed to create project', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProject = async (id: number) => {
    if (!editProjName.trim() || !token) return;
    try {
      const res = await fetch(`http://localhost:8000/projects/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: editProjName.trim(), description: editProjDesc.trim() })
      });
      if (res.ok) {
        setEditingProjectId(null);
        if (selectedWorkspace) {
          await fetchProjects(selectedWorkspace.id);
        }
      }
    } catch (e) {
      console.error('Failed to update project', e);
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:8000/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 204 || res.ok) {
        setDeletingProject(null);
        if (selectedWorkspace) {
          await fetchProjects(selectedWorkspace.id);
        }
      }
    } catch (e) {
      console.error('Failed to delete project', e);
    }
  };

  // Selection actions
  const selectWorkspaceCard = (ws: WorkspaceItem) => {
    setSelectedWorkspaceState(ws);
    setViewStep('projects');
    void fetchProjects(ws.id);
  };

  const selectProjectCard = (proj: ProjectItem) => {
    if (!selectedWorkspace) return;
    selectWorkspace(selectedWorkspace);
    selectProject(proj);
    router.push('/dashboard');
  };

  const startEditWorkspace = (ws: WorkspaceItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWorkspaceId(ws.id);
    setEditWsName(ws.name);
    setEditWsDesc(ws.description || '');
  };

  const startEditProject = (proj: ProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(proj.id);
    setEditProjName(proj.name);
    setEditProjDesc(proj.description || '');
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-accent" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/5 blur-[120px] rounded-full"></div>
      </div>

      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/20">
              <Bot size={20} />
            </span>
            <span className="font-black tracking-tight text-base">DocuMind</span>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        {viewStep === 'workspaces' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="max-w-xl">
              <span className="text-[10px] font-black uppercase tracking-widest text-accent">Step 1 of 2</span>
              <h1 className="text-3xl font-black tracking-tight mt-1 mb-2">Select your Workspace</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Workspaces are independent directories to group different projects. Choose an existing workspace or create a new one to begin.
              </p>
            </div>

            {/* List */}
            {isLoadingWorkspaces ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-accent" size={32} />
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {workspaces.map((ws) => (
                  <div key={ws.id} className="relative group">
                    {editingWorkspaceId === ws.id ? (
                      <div className="h-full border border-accent/30 bg-card rounded-3xl p-5 flex flex-col justify-between shadow-xl">
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editWsName}
                            onChange={(e) => setEditWsName(e.target.value)}
                            placeholder="Workspace name"
                            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-accent"
                          />
                          <textarea
                            value={editWsDesc}
                            onChange={(e) => setEditWsDesc(e.target.value)}
                            placeholder="Description"
                            rows={2}
                            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-accent resize-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                          <button
                            onClick={() => setEditingWorkspaceId(null)}
                            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={() => handleUpdateWorkspace(ws.id)}
                            className="p-1.5 bg-accent text-white rounded-lg hover:scale-105 transition-transform"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => selectWorkspaceCard(ws)}
                        className="h-full cursor-pointer border border-border bg-card hover:border-accent/40 rounded-3xl p-6 flex flex-col justify-between hover:shadow-2xl hover:shadow-accent/5 transition-all group/card relative overflow-hidden"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent group-hover/card:bg-accent group-hover/card:text-white transition-colors duration-300">
                              <Folder size={18} />
                            </span>
                            <h3 className="font-black text-sm group-hover/card:text-accent transition-colors duration-300">
                              {ws.name}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed font-medium">
                            {ws.description || 'No description provided.'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
                          <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider">
                            Created {new Date(ws.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => startEditWorkspace(ws, e)}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Rename"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingWorkspace(ws);
                              }}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Create Card Button */}
                <button
                  onClick={() => setShowCreateWorkspace(true)}
                  className="h-full min-h-[170px] border border-dashed border-border bg-card/20 hover:bg-card hover:border-accent/40 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 group/create transition-all cursor-pointer"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover/create:bg-accent/10 group-hover/create:text-accent transition-colors duration-300">
                    <Plus size={20} />
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground group-hover/create:text-foreground">
                    New Workspace
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            {/* Header / Breadcrumb */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setViewStep('workspaces')}
                className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-accent transition-colors self-start cursor-pointer"
              >
                <ArrowLeft size={14} /> Back to Workspaces
              </button>

              <div className="max-w-xl">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <span>Workspaces</span>
                  <ChevronRight size={12} className="text-border" />
                  <span className="text-accent font-bold">{selectedWorkspace?.name}</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight mt-2 mb-2">Select your Project</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Projects store specific uploaded documents, chats, and AI context. Select a project below or create a new one.
                </p>
              </div>
            </div>

            {/* List */}
            {isLoadingProjects ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-accent" size={32} />
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((proj) => (
                  <div key={proj.id} className="relative group">
                    {editingProjectId === proj.id ? (
                      <div className="h-full border border-accent/30 bg-card rounded-3xl p-5 flex flex-col justify-between shadow-xl">
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editProjName}
                            onChange={(e) => setEditProjName(e.target.value)}
                            placeholder="Project name"
                            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-accent"
                          />
                          <textarea
                            value={editProjDesc}
                            onChange={(e) => setEditProjDesc(e.target.value)}
                            placeholder="Description"
                            rows={2}
                            className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-accent resize-none"
                          />
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                          <button
                            onClick={() => setEditingProjectId(null)}
                            className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={() => handleUpdateProject(proj.id)}
                            className="p-1.5 bg-accent text-white rounded-lg hover:scale-105 transition-transform"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => selectProjectCard(proj)}
                        className="h-full cursor-pointer border border-border bg-card hover:border-accent/40 rounded-3xl p-6 flex flex-col justify-between hover:shadow-2xl hover:shadow-accent/5 transition-all group/card relative overflow-hidden"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent group-hover/card:bg-accent group-hover/card:text-white transition-colors duration-300">
                              <FileText size={18} />
                            </span>
                            <h3 className="font-black text-sm group-hover/card:text-accent transition-colors duration-300">
                              {proj.name}
                            </h3>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed font-medium">
                            {proj.description || 'No description provided.'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/50">
                          <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider">
                            Created {new Date(proj.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => startEditProject(proj, e)}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                              title="Rename"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingProject(proj);
                              }}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Create Card Button */}
                <button
                  onClick={() => setShowCreateProject(true)}
                  className="h-full min-h-[170px] border border-dashed border-border bg-card/20 hover:bg-card hover:border-accent/40 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 group/create transition-all cursor-pointer"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover/create:bg-accent/10 group-hover/create:text-accent transition-colors duration-300">
                    <Plus size={20} />
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-muted-foreground group-hover/create:text-foreground">
                    New Project
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete Workspace Confirmation */}
      {deletingWorkspace && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-sm rounded-3xl p-6 shadow-2xl shadow-black/20 animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-black mb-2 text-foreground">Delete Workspace?</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-foreground">"{deletingWorkspace.name}"</span>? 
              <br />
              <span className="text-red-500 font-bold mt-2 block">Warning: This will permanently delete all projects, documents, and chat history in this workspace. This action cannot be undone.</span>
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingWorkspace(null)}
                className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWorkspace(deletingWorkspace.id)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation */}
      {deletingProject && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-sm rounded-3xl p-6 shadow-2xl shadow-black/20 animate-in zoom-in-95 duration-300">
            <h3 className="text-lg font-black mb-2 text-foreground">Delete Project?</h3>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-foreground">"{deletingProject.name}"</span>? 
              <br />
              <span className="text-red-500 font-bold mt-2 block">Warning: This will permanently delete all uploaded documents and chat history in this project.</span>
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingProject(null)}
                className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(deletingProject.id)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateWorkspace && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateWorkspace}
            className="bg-card border border-border w-full max-w-md rounded-[32px] p-6 shadow-2xl shadow-black/20 animate-in zoom-in-95 duration-300 relative"
          >
            <button
              type="button"
              onClick={() => {
                setShowCreateWorkspace(false);
                setWsName('');
                setWsDesc('');
              }}
              className="absolute right-6 top-6 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-black mb-6 text-foreground">Create Workspace</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Workspace Name *</label>
                <input
                  type="text"
                  required
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="e.g. Finance Documents"
                  className="w-full bg-muted/45 border border-border rounded-2xl py-4 px-4 focus:outline-none focus:border-accent transition-all font-medium text-foreground text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description (Optional)</label>
                <textarea
                  value={wsDesc}
                  onChange={(e) => setWsDesc(e.target.value)}
                  placeholder="What is this workspace for?"
                  rows={3}
                  className="w-full bg-muted/45 border border-border rounded-2xl py-4 px-4 focus:outline-none focus:border-accent transition-all font-medium text-foreground text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => {
                  setShowCreateWorkspace(false);
                  setWsName('');
                  setWsDesc('');
                }}
                className="px-5 py-2.5 border border-border hover:bg-muted text-foreground text-sm font-bold rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-full transition-transform hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-accent/20 disabled:opacity-50 font-black"
              >
                {isSubmitting && <Loader2 className="animate-spin" size={14} />}
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateProject}
            className="bg-card border border-border w-full max-w-md rounded-[32px] p-6 shadow-2xl shadow-black/20 animate-in zoom-in-95 duration-300 relative"
          >
            <button
              type="button"
              onClick={() => {
                setShowCreateProject(false);
                setProjName('');
                setProjDesc('');
              }}
              className="absolute right-6 top-6 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-black mb-6 text-foreground">Create Project</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g. Q4 Audit Report"
                  className="w-full bg-muted/45 border border-border rounded-2xl py-4 px-4 focus:outline-none focus:border-accent transition-all font-medium text-foreground text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description (Optional)</label>
                <textarea
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="What documents/chats are in this project?"
                  rows={3}
                  className="w-full bg-muted/45 border border-border rounded-2xl py-4 px-4 focus:outline-none focus:border-accent transition-all font-medium text-foreground text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={() => {
                  setShowCreateProject(false);
                  setProjName('');
                  setProjDesc('');
                }}
                className="px-5 py-2.5 border border-border hover:bg-muted text-foreground text-sm font-bold rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-accent text-white text-sm font-bold rounded-full transition-transform hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-lg shadow-accent/20 disabled:opacity-50 font-black"
              >
                {isSubmitting && <Loader2 className="animate-spin" size={14} />}
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
