import React from 'react';
import { Upload, FileText, Bot, Loader2, Sparkles, AlertCircle, Files } from 'lucide-react';

interface UploadSectionProps {
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  error: string | null;
}

const UploadSection: React.FC<UploadSectionProps> = ({ onFileUpload, isUploading, error }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 text-accent rounded-full text-[10px] font-bold uppercase tracking-widest mb-6">
          <Sparkles size={12} />
          Next-Gen Document Intelligence
        </div>
        <h2 className="text-5xl md:text-6xl font-black mb-6 tracking-tight leading-tight">
          Unlock the knowledge in <br />
          <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent italic">your documents.</span>
        </h2>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto font-medium">
          Upload one or more files and let our agent analyze, compare, and extract insights instantly.
        </p>
      </div>

      <label className="relative group cursor-pointer">
        <input 
          type="file" 
          className="hidden" 
          onChange={onFileUpload} 
          accept=".pdf,.docx,.txt,.csv"
          multiple
          disabled={isUploading}
        />
        <div className={`
          w-72 h-72 rounded-[48px] border-2 border-dashed
          transition-all duration-500 flex flex-col items-center justify-center gap-6
          ${isUploading 
            ? 'bg-accent/5 border-accent animate-pulse' 
            : 'bg-card border-border hover:border-accent hover:bg-muted/50 shadow-2xl shadow-black/5'}
        `}>
          {isUploading ? (
            <>                        
              <Loader2 size={48} className="text-accent animate-spin" />
              <div className="text-center px-6">
                <p className="text-base font-bold mb-1">Processing...</p>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Building Knowledge Graph</p>
              </div>
            </>
          ) : (
            <> 
              <div className="w-20 h-20 rounded-3xl bg-accent/10 text-accent flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                <Upload size={32} />
              </div>
              <div className="text-center px-6">
                <p className="text-lg font-bold mb-1">Drop documents here</p>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">PDF, DOCX, TXT, CSV</p>
              </div>
            </>
          )}
        </div>
      </label>

      {error && (
        <div className="mt-8 flex items-center gap-3 text-red-500 bg-red-500/5 px-6 py-4 rounded-2xl border border-red-500/10 animate-in fade-in zoom-in-95">
          <AlertCircle size={20} />
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      <div className="mt-16 grid grid-cols-3 gap-8 text-center max-w-2xl">
        {[
          { label: 'Instant Summaries', icon: <FileText size={18} /> },
          { label: 'Cross-Doc Analysis', icon: <Files size={18} /> },
          { label: 'Deep Search', icon: <Bot size={18} /> },
        ].map((feat, i) => (
          <div key={i} className="flex flex-col items-center gap-3">
            <div className="text-muted-foreground/40">{feat.icon}</div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{feat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UploadSection;
