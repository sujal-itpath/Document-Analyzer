import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { FileText, Loader2, MessageSquareQuote } from 'lucide-react';
import * as mammoth from 'mammoth/mammoth.browser';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentItem {
  id: number;
  filename: string;
}

interface DocumentViewerProps {
  documents: DocumentItem[];
  activeDocumentId?: number;
  onDocumentChange?: (id: number) => void;
  onQuoteSelect?: (quote: string) => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documents, activeDocumentId, onDocumentChange, onQuoteSelect
}) => {
  const [numPages, setNumPages] = useState<number>();
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);

  const activeDoc = documents.find(d => d.id === activeDocumentId) || documents[0];

  const { token: authToken } = useAuth();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string>('');

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.quote-popup-btn')) return;

      const activeSelection = window.getSelection();
      const text = activeSelection?.toString().trim();
      if (text && text.length > 0) {
        const range = activeSelection?.getRangeAt(0);
        if (range) {
          const rect = range.getBoundingClientRect();
          setSelection({ text, top: rect.top, left: rect.left + rect.width / 2 });
        }
      } else {
        setSelection(null);
      }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    const isDocxLocal = activeDoc?.filename.toLowerCase().endsWith('.docx');
    if (!activeDoc || activeDoc.filename.toLowerCase().endsWith('.pdf')) {
      setBlobUrl(null);
      setDocxHtml('');
      return;
    }

    const fetchDocument = async () => {
      try {
        const res = await fetch(`http://localhost:8000/documents/${activeDoc.id}/content`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error('Failed to fetch document');
        const blob = await res.blob();
        
        if (isDocxLocal) {
          const arrayBuffer = await blob.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setDocxHtml(result.value);
        } else {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      } catch (err) {
        console.error('Error fetching document blob:', err);
      }
    };

    fetchDocument();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [activeDoc, authToken]);

  if (!activeDoc) return null;

  const isPDF = activeDoc.filename.toLowerCase().endsWith('.pdf');
  const isDocx = activeDoc.filename.toLowerCase().endsWith('.docx');

  const pdfFile = React.useMemo(() => ({
    url: `http://localhost:8000/documents/${activeDoc.id}/content`,
    httpHeaders: { Authorization: `Bearer ${authToken}` }
  }), [activeDoc.id, authToken]);

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex border-b border-border p-2 gap-2 overflow-x-auto custom-scrollbar">
        {documents.map(doc => (
          <button
            key={doc.id}
            onClick={() => {
              if (onDocumentChange) onDocumentChange(doc.id);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeDoc.id === doc.id
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <FileText size={12} />
            {doc.filename}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto relative p-4 bg-muted/20 flex justify-center custom-scrollbar">
        {selection && (
          <div 
            style={{ position: 'fixed', top: selection.top - 40, left: selection.left, transform: 'translateX(-50%)', zIndex: 9999 }}
            className="animate-in fade-in zoom-in-95 duration-200"
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                if (onQuoteSelect) onQuoteSelect(`> "${selection.text}"\n\n`);
                setSelection(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="quote-popup-btn flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <MessageSquareQuote size={12} /> Quote
            </button>
          </div>
        )}
        
        {isPDF ? (
          <Document
            file={pdfFile}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<Loader2 className="animate-spin text-accent mt-10" />}
            className="flex flex-col items-center"
          >
            {Array.from(new Array(numPages || 0), (el, index) => (
              <div key={`page_${index + 1}`} className="mb-6 shadow-2xl bg-white relative">
                <Page
                  pageNumber={index + 1}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  scale={1.2}
                />
              </div>
            ))}
          </Document>
        ) : isDocx ? (
          <div 
            className="w-full bg-white text-black p-8 rounded-xl shadow-2xl document-html-viewer prose max-w-none"
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        ) : blobUrl ? (
          <iframe 
            src={blobUrl} 
            className="w-full h-full bg-white rounded-xl shadow-2xl border border-border"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-accent" />
          </div>
        )}
      </div>
    </div>
  );
};
export default DocumentViewer;
