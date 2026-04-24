import React from 'react';
import { FileText, ExternalLink, X } from 'lucide-react';

interface DocumentPreviewProps {
  url: string | null;
  filename: string | null;
  onClose: () => void;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ url, filename, onClose }) => {
  if (!url) return null;

  const isPdf = filename?.toLowerCase().endsWith('.pdf');
  const isTxt = filename?.toLowerCase().endsWith('.txt');

  return (
    <div className="w-full lg:w-[450px] xl:w-[550px] h-full bg-zinc-950 border-l border-white/5 flex flex-col transition-all duration-500 animate-in slide-in-from-right-8">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-zinc-900/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <FileText size={16} className="text-blue-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-200 truncate max-w-[200px]">{filename}</span>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Document Preview</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-all"
            title="Open in new tab"
          >
            <ExternalLink size={16} />
          </a>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg text-zinc-500 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-zinc-900/10 overflow-hidden relative">
        {isPdf ? (
          <iframe 
            src={`${url}#toolbar=0`} 
            className="w-full h-full border-none"
            title="PDF Preview"
          />
        ) : isTxt ? (
          <div className="w-full h-full p-6 overflow-y-auto custom-scrollbar">
            <iframe 
              src={url} 
              className="w-full h-full border-none bg-transparent text-zinc-300"
              title="Text Preview"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-4">
              <FileText size={32} className="text-zinc-600" />
            </div>
            <p className="text-sm font-bold text-zinc-400 mb-2">Preview not available</p>
            <p className="text-xs text-zinc-600 mb-6">This file type cannot be previewed directly, but you can still chat about it.</p>
            <a 
              href={url} 
              download
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-lg text-xs font-bold transition-all"
            >
              Download File
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentPreview;
