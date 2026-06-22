'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { apiUrl, authHeaders } from '../../lib/api';
import type { ProjectItem, WorkspaceItem } from '../../lib/types';
import ThemeToggle from '../../components/ThemeToggle';
import { 
  Bot, Folder, Plus, Trash2, Edit2, ArrowLeft, 
  LogOut, Loader2, Check, X, ChevronRight, FileText,
  Briefcase
} from 'lucide-react';

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
      const res = await fetch(apiUrl('/workspaces'), {
        headers: authHeaders(token)
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
      const res = await fetch(apiUrl(`/workspaces/${workspaceId}/projects`), {
        headers: authHeaders(token)
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
      const res = await fetch(apiUrl('/workspaces'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token)
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
      const res = await fetch(apiUrl(`/workspaces/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token)
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
      const res = await fetch(apiUrl(`/workspaces/${id}`), {
        method: 'DELETE',
        headers: authHeaders(token)
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
      const res = await fetch(apiUrl(`/workspaces/${selectedWorkspace.id}/projects`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token)
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
      const res = await fetch(apiUrl(`/projects/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token)
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
      const res = await fetch(apiUrl(`/projects/${id}`), {
        method: 'DELETE',
        headers: authHeaders(token)
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
      {/* Dynamic Professional Backgrounds */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-accent/5 blur-[140px] rounded-full mix-blend-screen" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-blue-500/5 blur-[140px] rounded-full mix-blend-screen" />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-accent to-blue-600 text-white shadow-xl shadow-accent/20">
              <Bot size={22} />
            </span>
            <span className="font-black tracking-tight text-lg">DocuMind</span>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle className="border border-border/50 bg-card/50" />
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/50 px-4 py-2.5 text-sm font-bold text-muted-foreground transition-all hover:bg-muted hover:text-foreground hover:shadow-lg"
            >
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-16 flex flex-col">
        {viewStep === 'workspaces' ? (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-black uppercase tracking-widest mb-6">
                <Briefcase size={14} />
                <span>Step 1 of 2</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">Select your Workspace</h1>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-xl">
                Workspaces are independent environments to group different projects. Choose an existing workspace or create a new one to begin your secure session.
              </p>
            </div>

            {isLoadingWorkspaces ? (
              <div className="flex justify-center items-center py-32">
                <Loader2 className="animate-spin text-accent" size={40} />
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {/* Create New Card */}
                <button
                  onClick={() => setShowCreateWorkspace(true)}
                  className="group relative h-full min-h-[220px] rounded-[2rem] border-2 border-dashed border-border/60 bg-transparent hover:bg-card/30 hover:border-accent/40 p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:shadow-2xl hover:shadow-accent/5"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-muted/50 text-muted-foreground group-hover:bg-accent group-hover:text-white group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-accent/20 transition-all duration-300">
                    <Plus size={24} strokeWidth={3} />
                  </span>
                  <div className="text-center">
                    <h3 className="font-black text-foreground group-hover:text-accent transition-colors">New Workspace</h3>
                    <p className="text-xs text-muted-foreground mt-1">Create an empty environment</p>
                  </div>
                </button>

                {/* Existing Workspaces */}
                {workspaces.map((ws) => (
                  <div key={ws.id} className="relative group">
                    {editingWorkspaceId === ws.id ? (
                      <div className="h-full border border-accent/50 bg-card rounded-[2rem] p-6 flex flex-col justify-between shadow-2xl shadow-accent/10 transition-all duration-300">
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Name</label>
                            <input
                              type="text"
                              value={editWsName}
                              onChange={(e) => setEditWsName(e.target.value)}
                              placeholder="Workspace name"
                              className="mt-1 w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description</label>
                            <textarea
                              value={editWsDesc}
                              onChange={(e) => setEditWsDesc(e.target.value)}
                              placeholder="Description"
                              rows={2}
                              className="mt-1 w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none transition-all"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                          <button
                            onClick={() => setEditingWorkspaceId(null)}
                            className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X size={18} />
                          </button>
                          <button
                            onClick={() => handleUpdateWorkspace(ws.id)}
                            className="p-2 bg-accent text-white rounded-xl hover:scale-105 shadow-lg shadow-accent/20 transition-all"
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => selectWorkspaceCard(ws)}
                        className="group/card relative h-full min-h-[220px] cursor-pointer rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-sm p-6 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:bg-card hover:border-accent/30 hover:shadow-2xl hover:shadow-accent/5 hover:-translate-y-1"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-[40px] group-hover/card:bg-accent/10 transition-colors pointer-events-none" />
                        
                        <div className="space-y-4 relative z-10">
                          <div className="flex items-center gap-4">
                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/50 border border-border/50 text-foreground group-hover/card:from-accent group-hover/card:to-blue-600 group-hover/card:text-white group-hover/card:border-transparent group-hover/card:shadow-lg transition-all duration-300">
                              <Folder size={20} className="group-hover/card:scale-110 transition-transform duration-300" />
                            </span>
                            <h3 className="font-black text-lg text-foreground group-hover/card:text-accent transition-colors line-clamp-1">
                              {ws.name}
                            </h3>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed font-medium group-hover/card:text-muted-foreground/90 transition-colors">
                            {ws.description || 'No description provided.'}
                          </p>
                        </div>

                        <div className="relative z-10 flex items-center justify-between mt-6 pt-5 border-t border-border/30">
                          <span className="text-[10px] text-muted-foreground/70 font-black uppercase tracking-wider">
                            {new Date(ws.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 translate-x-2 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all duration-300">
                            <button
                              onClick={(e) => startEditWorkspace(ws, e)}
                              className="p-2 bg-background/50 hover:bg-muted border border-transparent hover:border-border/50 rounded-xl text-muted-foreground hover:text-foreground transition-all"
                              title="Rename"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingWorkspace(ws);
                              }}
                              className="p-2 bg-background/50 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl text-muted-foreground hover:text-red-500 transition-all"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-12 animate-in slide-in-from-right-8 duration-500">
            {/* Header / Breadcrumb */}
            <div className="flex flex-col gap-6">
              <button
                onClick={() => setViewStep('workspaces')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card/50 border border-border/50 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-card hover:shadow-lg transition-all self-start"
              >
                <ArrowLeft size={16} /> Back to Workspaces
              </button>

              <div className="max-w-2xl">
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground font-bold mb-4 bg-muted/30 w-fit px-4 py-1.5 rounded-full border border-border/30">
                  <span>Workspaces</span>
                  <ChevronRight size={14} className="text-muted-foreground/50" />
                  <span className="text-accent flex items-center gap-1.5">
                    <Folder size={14} /> {selectedWorkspace?.name}
                  </span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">Select your Project</h1>
                <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-xl">
                  Projects isolate specific documents and chat histories. Choose a project below or create a new one to start working.
                </p>
              </div>
            </div>

            {/* List */}
            {isLoadingProjects ? (
              <div className="flex justify-center items-center py-32">
                <Loader2 className="animate-spin text-accent" size={40} />
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {/* Create New Card */}
                <button
                  onClick={() => setShowCreateProject(true)}
                  className="group relative h-full min-h-[220px] rounded-[2rem] border-2 border-dashed border-border/60 bg-transparent hover:bg-card/30 hover:border-accent/40 p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:shadow-2xl hover:shadow-accent/5"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-muted/50 text-muted-foreground group-hover:bg-accent group-hover:text-white group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-accent/20 transition-all duration-300">
                    <Plus size={24} strokeWidth={3} />
                  </span>
                  <div className="text-center">
                    <h3 className="font-black text-foreground group-hover:text-accent transition-colors">New Project</h3>
                    <p className="text-xs text-muted-foreground mt-1">Create an empty project</p>
                  </div>
                </button>

                {/* Existing Projects */}
                {projects.map((proj) => (
                  <div key={proj.id} className="relative group">
                    {editingProjectId === proj.id ? (
                      <div className="h-full border border-accent/50 bg-card rounded-[2rem] p-6 flex flex-col justify-between shadow-2xl shadow-accent/10 transition-all duration-300">
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Name</label>
                            <input
                              type="text"
                              value={editProjName}
                              onChange={(e) => setEditProjName(e.target.value)}
                              placeholder="Project name"
                              className="mt-1 w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description</label>
                            <textarea
                              value={editProjDesc}
                              onChange={(e) => setEditProjDesc(e.target.value)}
                              placeholder="Description"
                              rows={2}
                              className="mt-1 w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none transition-all"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                          <button
                            onClick={() => setEditingProjectId(null)}
                            className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X size={18} />
                          </button>
                          <button
                            onClick={() => handleUpdateProject(proj.id)}
                            className="p-2 bg-accent text-white rounded-xl hover:scale-105 shadow-lg shadow-accent/20 transition-all"
                          >
                            <Check size={18} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => selectProjectCard(proj)}
                        className="group/card relative h-full min-h-[220px] cursor-pointer rounded-[2rem] border border-border/50 bg-card/40 backdrop-blur-sm p-6 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:bg-card hover:border-accent/30 hover:shadow-2xl hover:shadow-accent/5 hover:-translate-y-1"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-[40px] group-hover/card:bg-blue-500/10 transition-colors pointer-events-none" />
                        
                        <div className="space-y-4 relative z-10">
                          <div className="flex items-center gap-4">
                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/50 border border-border/50 text-foreground group-hover/card:from-blue-600 group-hover/card:to-indigo-600 group-hover/card:text-white group-hover/card:border-transparent group-hover/card:shadow-lg transition-all duration-300">
                              <FileText size={20} className="group-hover/card:scale-110 transition-transform duration-300" />
                            </span>
                            <h3 className="font-black text-lg text-foreground group-hover/card:text-blue-500 transition-colors line-clamp-1">
                              {proj.name}
                            </h3>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed font-medium group-hover/card:text-muted-foreground/90 transition-colors">
                            {proj.description || 'No description provided.'}
                          </p>
                        </div>

                        <div className="relative z-10 flex items-center justify-between mt-6 pt-5 border-t border-border/30">
                          <span className="text-[10px] text-muted-foreground/70 font-black uppercase tracking-wider">
                            {new Date(proj.created_at).toLocaleDateString()}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 translate-x-2 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all duration-300">
                            <button
                              onClick={(e) => startEditProject(proj, e)}
                              className="p-2 bg-background/50 hover:bg-muted border border-transparent hover:border-border/50 rounded-xl text-muted-foreground hover:text-foreground transition-all"
                              title="Rename"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingProject(proj);
                              }}
                              className="p-2 bg-background/50 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl text-muted-foreground hover:text-red-500 transition-all"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete Workspace Confirmation Modal */}
      {deletingWorkspace && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-card border border-border/50 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl shadow-black/40 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-4 mb-6">
              <span className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-red-500/10 text-red-500">
                <Trash2 size={24} />
              </span>
              <div>
                <h3 className="text-2xl font-black text-foreground">Delete Workspace</h3>
                <p className="text-sm font-bold text-muted-foreground mt-1">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-base text-muted-foreground mb-8 leading-relaxed">
              Are you sure you want to delete <span className="font-black text-foreground">"{deletingWorkspace.name}"</span>? 
              <br /><br />
              All projects, documents, and chat history within this workspace will be permanently erased.
            </p>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingWorkspace(null)}
                className="px-6 py-3 text-sm font-bold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteWorkspace(deletingWorkspace.id)}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-black rounded-full shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                Yes, Delete Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deletingProject && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-card border border-border/50 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl shadow-black/40 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-4 mb-6">
              <span className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-red-500/10 text-red-500">
                <Trash2 size={24} />
              </span>
              <div>
                <h3 className="text-2xl font-black text-foreground">Delete Project</h3>
                <p className="text-sm font-bold text-muted-foreground mt-1">This action cannot be undone.</p>
              </div>
            </div>
            
            <p className="text-base text-muted-foreground mb-8 leading-relaxed">
              Are you sure you want to delete <span className="font-black text-foreground">"{deletingProject.name}"</span>? 
              <br /><br />
              All documents and chat history within this project will be permanently erased.
            </p>
            
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingProject(null)}
                className="px-6 py-3 text-sm font-bold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(deletingProject.id)}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white text-sm font-black rounded-full shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                Yes, Delete Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {showCreateWorkspace && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <form
            onSubmit={handleCreateWorkspace}
            className="bg-card border border-border/50 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl shadow-black/40 animate-in zoom-in-95 duration-300 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[60px] pointer-events-none" />
            
            <button
              type="button"
              onClick={() => {
                setShowCreateWorkspace(false);
                setWsName('');
                setWsDesc('');
              }}
              className="absolute right-6 top-6 rounded-xl p-2.5 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground transition-colors cursor-pointer z-10"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4 mb-8">
              <span className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-accent/10 text-accent">
                <Folder size={24} />
              </span>
              <div>
                <h3 className="text-2xl font-black text-foreground">Create Workspace</h3>
                <p className="text-sm font-bold text-muted-foreground mt-1">Setup a new isolated environment.</p>
              </div>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Workspace Name <span className="text-accent">*</span></label>
                <input
                  type="text"
                  required
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="e.g. Finance Division"
                  className="w-full bg-background/50 border border-border/50 rounded-2xl py-4 px-5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-bold text-foreground text-base shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Description (Optional)</label>
                <textarea
                  value={wsDesc}
                  onChange={(e) => setWsDesc(e.target.value)}
                  placeholder="What is the primary purpose of this workspace?"
                  rows={3}
                  className="w-full bg-background/50 border border-border/50 rounded-2xl py-4 px-5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-medium text-foreground text-base resize-none shadow-inner"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-10 relative z-10">
              <button
                type="button"
                onClick={() => {
                  setShowCreateWorkspace(false);
                  setWsName('');
                  setWsDesc('');
                }}
                className="px-6 py-3 text-sm font-bold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-gradient-to-r from-accent to-blue-600 text-white text-sm font-black rounded-full transition-all hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                Create Workspace
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <form
            onSubmit={handleCreateProject}
            className="bg-card border border-border/50 w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl shadow-black/40 animate-in zoom-in-95 duration-300 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[60px] pointer-events-none" />
            
            <button
              type="button"
              onClick={() => {
                setShowCreateProject(false);
                setProjName('');
                setProjDesc('');
              }}
              className="absolute right-6 top-6 rounded-xl p-2.5 text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground transition-colors cursor-pointer z-10"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4 mb-8">
              <span className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-blue-500/10 text-blue-500">
                <FileText size={24} />
              </span>
              <div>
                <h3 className="text-2xl font-black text-foreground">Create Project</h3>
                <p className="text-sm font-bold text-muted-foreground mt-1">Start a new document collection.</p>
              </div>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Project Name <span className="text-blue-500">*</span></label>
                <input
                  type="text"
                  required
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g. Q4 Audit Report"
                  className="w-full bg-background/50 border border-border/50 rounded-2xl py-4 px-5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-bold text-foreground text-base shadow-inner"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Description (Optional)</label>
                <textarea
                  value={projDesc}
                  onChange={(e) => setProjDesc(e.target.value)}
                  placeholder="What documents or tasks belong in this project?"
                  rows={3}
                  className="w-full bg-background/50 border border-border/50 rounded-2xl py-4 px-5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium text-foreground text-base resize-none shadow-inner"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-10 relative z-10">
              <button
                type="button"
                onClick={() => {
                  setShowCreateProject(false);
                  setProjName('');
                  setProjDesc('');
                }}
                className="px-6 py-3 text-sm font-bold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-full transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-black rounded-full transition-all hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
