import React, { useState, useEffect } from 'react';
import {
  FileText, Plus, Trash2, Calendar, Loader2, X, Eye,
  CheckCircle2, Circle, MessageCircle, ChevronRight, Upload
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from './ui/Dialog';

interface Document {
  id: number;
  filename: string;
  upload_date: string;
  summary?: string;
  suggestions?: string;
}

interface HomeViewProps {
  onSelectDocuments?: (docs: Document[]) => void;
  onOpenChat?: (docs: Document[]) => void;
  /** When 'select', shows a floating "Start Chat" bar. Default: 'manage' */
  mode?: 'manage' | 'select';
  initialSelectedIds?: number[];
  onDocumentDeleted?: (docId: number) => void;
}


const HomeView = ({
  onSelectDocuments,
  onOpenChat,
  mode = 'manage',
  initialSelectedIds = [],
  onDocumentDeleted,
}: HomeViewProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSelectedIds);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const { token, logout } = useAuth();
  const dialog = useDialog();

  useEffect(() => {
    setIsMounted(true);
    fetchDocuments();
  }, []);

  // Notify parent of selection changes
  useEffect(() => {
    if (onSelectDocuments) {
      onSelectDocuments(documents.filter(d => selectedIds.includes(d.id)));
    }
  }, [selectedIds, documents]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('http://localhost:8000/documents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) setDocuments(await res.json());
    } catch (err) {
      console.error('Failed to fetch documents', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (doc: Document) => {
    setSelectedIds(prev =>
      prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
    );
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) formData.append('files', files[i]);
    formData.append('overwrite', 'false');
    try {
      const res = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok) {
        await fetchDocuments();
      } else {
        const err = await res.json();
        await dialog.alert({ title: 'Upload failed', message: err.detail || 'Upload failed', variant: 'danger' });
      }
    } catch (err) {
      await dialog.alert({ title: 'Upload failed', message: 'Upload failed. Please check your connection.', variant: 'danger' });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await dialog.confirm({
      title: 'Delete document?',
      message: `Are you sure you want to delete "${doc.filename}"?\n\nWarning: This will permanently remove the document and all associated chat context. This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`http://localhost:8000/documents/${doc.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      if (res.ok || res.status === 404) {
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
        setSelectedIds(prev => prev.filter(id => id !== doc.id));
        if (previewDoc?.id === doc.id) setPreviewDoc(null);
        if (onDocumentDeleted) onDocumentDeleted(doc.id);
      }
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const selectedDocs = documents.filter(d => selectedIds.includes(d.id));

  return (
    <div className="flex h-full relative">
      {/* Main content */}
      <div className={`flex-1 overflow-y-auto transition-all duration-300 ${previewDoc ? 'mr-[360px]' : ''}`}>
        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-black tracking-tight mb-1">My Documents</h2>
              <p className="text-muted-foreground text-sm">
                {mode === 'select'
                  ? 'Select documents to include in your chat session'
                  : 'Upload and manage your knowledge base'}
              </p>
            </div>
            <div className="relative group">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                accept=".pdf,.txt,.docx,.csv,.md"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              <div className="absolute -inset-0.5 bg-gradient-to-r from-accent to-indigo-500 rounded-2xl blur opacity-20 group-hover:opacity-60 transition duration-500" />
              <button
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={isUploading}
                className="relative flex items-center gap-2 bg-accent text-white px-5 py-3 rounded-2xl font-black text-sm shadow-xl shadow-accent/20 transition-all active:scale-95 disabled:opacity-50 hover:shadow-2xl hover:shadow-accent/30"
              >
                {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                {isUploading ? 'Uploading…' : 'Upload Files'}
              </button>
            </div>
          </div>

          {/* Select-all bar (select mode) */}
          {mode === 'select' && documents.length > 0 && (
            <div className="flex items-center justify-between bg-accent/5 border border-accent/20 rounded-2xl px-5 py-3">
              <span className="text-sm font-bold text-accent">
                {selectedIds.length === 0
                  ? 'Click documents to select them'
                  : `${selectedIds.length} document${selectedIds.length > 1 ? 's' : ''} selected`}
              </span>
              <button
                onClick={() =>
                  setSelectedIds(
                    selectedIds.length === documents.length ? [] : documents.map(d => d.id)
                  )
                }
                className="text-xs font-black text-accent hover:underline"
              >
                {selectedIds.length === documents.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          )}

          {/* Document grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {isLoading
              ? Array(6).fill(0).map((_, i) => (
                  <div key={i} className="bg-card border border-border p-6 rounded-3xl h-44 animate-pulse" />
                ))
              : documents.length === 0
              ? (
                <div className="col-span-full py-24 flex flex-col items-center justify-center bg-card/50 border-2 border-dashed border-border rounded-[48px]">
                  <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mb-6 text-muted-foreground">
                    <FileText size={40} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No documents yet</h3>
                  <p className="text-muted-foreground text-sm mb-8">Upload your first document to get started</p>
                  <button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl shadow-accent/20 hover:scale-105 transition-all"
                  >
                    <Plus size={16} /> Upload Document
                  </button>
                </div>
              )
              : documents.map(doc => {
                  const isSelected = selectedIds.includes(doc.id);
                  const isPreviewing = previewDoc?.id === doc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => {
                        if (mode === 'select') {
                          toggleSelection(doc);
                        } else {
                          setPreviewDoc(isPreviewing ? null : doc);
                        }
                      }}
                      className={`group relative bg-card border-2 p-5 rounded-[28px] cursor-pointer transition-all duration-300 flex flex-col gap-4 ${
                        isSelected
                          ? 'border-accent bg-accent/5 shadow-xl shadow-accent/10'
                          : isPreviewing
                          ? 'border-accent/50 bg-accent/3'
                          : 'border-border hover:border-accent/40 hover:shadow-lg'
                      }`}
                    >
                      {/* Selection badge */}
                      {mode === 'select' && (
                        <div className={`absolute top-4 right-4 transition-all duration-200 ${isSelected ? 'opacity-100' : 'opacity-30 group-hover:opacity-70'}`}>
                          {isSelected
                            ? <CheckCircle2 size={20} className="text-accent" />
                            : <Circle size={20} className="text-muted-foreground" />
                          }
                        </div>
                      )}

                      {/* File icon + actions */}
                      <div className="flex items-start justify-between">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${isSelected ? 'bg-accent text-white' : 'bg-accent/10 text-accent'}`}>
                          <FileText size={20} />
                        </div>

                        {/* Manage mode actions */}
                        {mode === 'manage' && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setPreviewDoc(isPreviewing ? null : doc)}
                              className="p-1.5 hover:bg-accent/10 rounded-lg text-muted-foreground hover:text-accent transition-colors"
                              title="Preview"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => onOpenChat?.([doc])}
                              className="p-1.5 hover:bg-accent/10 rounded-lg text-muted-foreground hover:text-accent transition-colors"
                              title="Chat with this document"
                            >
                              <MessageCircle size={14} />
                            </button>
                            <button
                              onClick={e => handleDelete(doc, e)}
                              className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* File name */}
                      <div>
                        <h4
                          className={`text-sm font-black truncate transition-colors mb-1 ${isSelected ? 'text-accent' : 'group-hover:text-accent'}`}
                          title={doc.filename}
                        >
                          {doc.filename}
                        </h4>
                        {doc.summary && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {doc.summary}
                          </p>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mt-auto">
                        <span className="flex items-center gap-1">
                          <Calendar size={10} />
                          {isMounted ? new Date(doc.upload_date).toLocaleDateString() : '…'}
                        </span>
                        <span className={`flex items-center gap-1 ${doc.summary ? 'text-emerald-500/70' : 'text-amber-500/70'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${doc.summary ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {doc.summary ? 'Analyzed' : 'Indexing'}
                        </span>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </div>

      {/* Preview Panel */}
      {previewDoc && (
        <div className="fixed right-0 top-0 bottom-0 w-[360px] bg-card border-l border-border flex flex-col z-40 animate-in slide-in-from-right duration-300 shadow-2xl">
          <div className="p-5 border-b border-border flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mb-1">Document Preview</p>
              <h3 className="font-black text-sm truncate" title={previewDoc.filename}>{previewDoc.filename}</h3>
            </div>
            <button
              onClick={() => setPreviewDoc(null)}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors ml-3 flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-5">
            {/* Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${previewDoc.summary ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className="text-xs font-bold text-muted-foreground">
                {previewDoc.summary ? 'Analysis complete' : 'Still indexing…'}
              </span>
            </div>

            {/* Upload date */}
            <div className="bg-muted/40 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Uploaded</p>
              <p className="text-sm font-bold">
                {isMounted ? new Date(previewDoc.upload_date).toLocaleString() : '…'}
              </p>
            </div>

            {/* Summary */}
            {previewDoc.summary && (
              <div className="bg-muted/40 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-2">AI Summary</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{previewDoc.summary}</p>
              </div>
            )}

            {/* Suggested questions */}
            {previewDoc.suggestions && (() => {
              try {
                const list: string[] = JSON.parse(previewDoc.suggestions);
                if (Array.isArray(list) && list.length > 0) {
                  return (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">Suggested Questions</p>
                      <div className="space-y-2">
                        {list.map((q, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-2.5 rounded-xl">
                            <span className="text-accent font-black mt-0.5">→</span>
                            {q}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
              } catch { }
              return null;
            })()}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-border space-y-2">
            <button
              onClick={() => { onOpenChat?.([previewDoc]); setPreviewDoc(null); }}
              className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3 rounded-2xl font-black text-sm shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <MessageCircle size={16} />
              Chat with this Document
            </button>
            <button
              onClick={() => setPreviewDoc(null)}
              className="w-full flex items-center justify-center gap-2 text-muted-foreground py-2.5 rounded-2xl font-bold text-sm hover:bg-muted transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Floating "Start Chat" bar (select mode) */}
      {mode === 'select' && selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-4 bg-card border border-border/80 rounded-full px-6 py-3.5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {selectedDocs.slice(0, 3).map(d => (
                  <div key={d.id} className="w-7 h-7 bg-accent/10 border-2 border-card rounded-full flex items-center justify-center">
                    <FileText size={12} className="text-accent" />
                  </div>
                ))}
              </div>
              <span className="text-sm font-black">
                {selectedIds.length} doc{selectedIds.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <button
              onClick={() => onOpenChat?.(selectedDocs)}
              className="flex items-center gap-2 bg-accent text-white px-5 py-2 rounded-full font-black text-sm shadow-lg shadow-accent/30 hover:shadow-xl hover:shadow-accent/40 transition-all hover:scale-105 active:scale-95"
            >
              Start Chat <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeView;
