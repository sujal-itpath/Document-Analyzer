import React, { useState, useEffect } from 'react';
import { FileText, Plus, Trash2, Calendar, FileDown, Search, Loader2, MoreVertical, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Document {
  id: number;
  filename: string;
  upload_date: string;
  summary?: string;
  suggestions?: string;
}

const HomeView = ({ 
  onSelectDocuments,
  onOpenChat
}: { 
  onSelectDocuments?: (docs: Document[]) => void;
  onOpenChat?: (docs: Document[]) => void;
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    setIsMounted(true);
    fetchDocuments();
  }, []);

  const toggleSelection = (doc: Document) => {
    const newSelection = selectedIds.includes(doc.id)
      ? selectedIds.filter(id => id !== doc.id)
      : [...selectedIds, doc.id];
    
    setSelectedIds(newSelection);
    if (onSelectDocuments) {
      const selectedDocs = documents.filter(d => newSelection.includes(d.id));
      onSelectDocuments(selectedDocs);
    }
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('overwrite', 'true');

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        await fetchDocuments();
      } else {
        const error = await response.json();
        alert(error.detail || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed. Please check your connection.');
    } finally {
      setIsUploading(false);
      event.target.value = ''; // Reset input
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch('http://localhost:8000/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Failed to fetch documents', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black tracking-tight mb-2">My Documents</h2>
          <p className="text-muted-foreground font-medium">Manage and organize your knowledge base</p>
        </div>
        <div className="relative group">
          <input 
            type="file" 
            id="file-upload" 
            className="hidden" 
            multiple 
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <div className="absolute -inset-1 bg-gradient-to-r from-accent to-indigo-500 rounded-2xl blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
          <button 
            onClick={() => document.getElementById('file-upload')?.click()}
            disabled={isUploading}
            className="relative flex items-center gap-2 bg-accent text-white px-6 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-accent/20 transition-transform active:scale-95 disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            {isUploading ? 'Uploading...' : 'Upload New'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-card border border-border p-6 rounded-3xl h-48 animate-pulse"></div>
          ))
        ) : documents.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center bg-card/50 border-2 border-dashed border-border rounded-[48px]">
             <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mb-6 text-muted-foreground">
               <FileText size={40} />
             </div>
             <h3 className="text-xl font-bold mb-2">No documents yet</h3>
             <p className="text-muted-foreground mb-8">Upload your first document to start analyzing</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div 
              key={doc.id} 
              onClick={() => toggleSelection(doc)}
              className={`group bg-card border-2 p-6 rounded-[32px] cursor-pointer transition-all duration-500 relative overflow-hidden flex flex-col justify-between ${
                selectedIds.includes(doc.id) ? 'border-accent bg-accent/5 shadow-2xl shadow-accent/5' : 'border-border hover:border-accent/50'
              }`}
            >
              <div className={`absolute top-4 right-4 transition-all duration-300 z-10 ${selectedIds.includes(doc.id) ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
                 <div className="bg-accent text-white rounded-full p-1 shadow-lg shadow-accent/40">
                    <Plus className="rotate-45" size={16} />
                 </div>
              </div>
              
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${selectedIds.includes(doc.id) ? 'bg-accent text-white' : 'bg-accent/10 text-accent'}`}>
                    <FileText size={24} />
                  </div>
                  <div className="flex gap-1 relative" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setActiveMenu(activeMenu === doc.id ? null : doc.id)}
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                    >
                      <MoreVertical size={16}/>
                    </button>
                    
                    {activeMenu === doc.id && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                        <button 
                          onClick={() => {
                            if (onOpenChat) onOpenChat([doc]);
                            setActiveMenu(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold hover:bg-accent hover:text-white transition-colors"
                        >
                          <MessageCircle size={16} />
                          Open Chat
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold hover:bg-muted transition-colors">
                          <FileDown size={16} />
                          Download
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h4 className={`text-lg font-black truncate mb-2 transition-colors ${selectedIds.includes(doc.id) ? 'text-accent' : 'group-hover:text-accent'}`} title={doc.filename}>
                  {doc.filename}
                </h4>

                {doc.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 font-medium italic">
                    "{doc.summary}"
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} />
                  {isMounted ? new Date(doc.upload_date).toLocaleDateString() : 'Loading...'}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${doc.summary ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                  {doc.summary ? 'Analyzed' : 'Indexing'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HomeView;
