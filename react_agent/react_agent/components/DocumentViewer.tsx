'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { FileText, Loader2, MessageSquareQuote } from 'lucide-react';
import * as mammoth from 'mammoth/mammoth.browser';
import { apiUrl, authHeaders } from '../lib/api';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentItem {
  id: number;
  filename: string;
  google_doc_id?: string;
}

interface DocumentViewerProps {
  documents: DocumentItem[];
  activeDocumentId?: number;
  onDocumentChange?: (id: number) => void;
  /** Called with the raw selected text (no markdown prefix). */
  onQuoteSelect?: (text: string) => void;
}

// ── Plain-text renderer ───────────────────────────────────────────────────────
// Renders a .txt file (including synced Google Docs) as formatted HTML instead
// of dumping it raw into an <iframe>. Parses #/## headings, blank-line paragraphs,
// and preserves code-fence blocks.

function PlainTextRenderer({ content }: { content: string }) {
  const lines = content.split('\n');

  const elements: React.ReactNode[] = [];
  let i = 0;
  let paraBuffer: string[] = [];

  const flushPara = () => {
    if (paraBuffer.length > 0) {
      elements.push(
        <p key={`p-${i}`} className="mb-3 leading-7 text-foreground/90 text-sm">
          {paraBuffer.join(' ')}
        </p>
      );
      paraBuffer = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Heading 1
    if (/^#\s/.test(line)) {
      flushPara();
      elements.push(
        <h1 key={`h1-${i}`} className="text-xl font-black mt-6 mb-2 text-foreground">
          {line.replace(/^#\s+/, '')}
        </h1>
      );
      i++;
      continue;
    }

    // Heading 2
    if (/^##\s/.test(line)) {
      flushPara();
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-black mt-5 mb-1.5 text-foreground">
          {line.replace(/^##\s+/, '')}
        </h2>
      );
      i++;
      continue;
    }

    // Heading 3
    if (/^###\s/.test(line)) {
      flushPara();
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-black mt-4 mb-1 text-foreground uppercase tracking-wide">
          {line.replace(/^###\s+/, '')}
        </h3>
      );
      i++;
      continue;
    }

    // Code fence
    if (line.startsWith('```')) {
      flushPara();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={`code-${i}`} className="bg-muted/60 rounded-xl p-4 my-3 overflow-x-auto text-xs font-mono text-accent leading-5 border border-border">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushPara();
      elements.push(<hr key={`hr-${i}`} className="border-border my-5" />);
      i++;
      continue;
    }

    // Blank line → flush paragraph
    if (line.trim() === '') {
      flushPara();
      i++;
      continue;
    }

    // Normal text → accumulate into paragraph
    paraBuffer.push(line.trim());
    i++;
  }
  flushPara();

  return (
    <div className="w-full h-fit max-w-3xl mx-auto bg-white dark:bg-zinc-950 text-foreground p-8 rounded-xl shadow-2xl border border-border text-sm leading-7 select-text selection:bg-accent/30 selection:text-accent-foreground">
      {elements}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documents, activeDocumentId, onDocumentChange, onQuoteSelect
}) => {
  const [numPages, setNumPages] = useState<number>();
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [docxHtml, setDocxHtml] = useState<string>('');
  const [txtContent, setTxtContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const activeDoc = documents.find(d => d.id === activeDocumentId) || documents[0];
  const { token: authToken } = useAuth();

  // ── Selection / Quote popup ─────────────────────────────────────────────────
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.quote-popup-btn')) return;
      if (!target.closest('.document-viewer-content-area')) {
        setSelection(null);
        return;
      }

      const activeSelection = window.getSelection();
      const text = activeSelection?.toString().trim();
      if (text && text.length > 2) {
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

  // ── Fetch document content ──────────────────────────────────────────────────
  useEffect(() => {
    if (!activeDoc) return;

    const filename = activeDoc.filename.toLowerCase();
    const isPDF = filename.endsWith('.pdf');

    // PDF is handled directly via react-pdf — no blob fetch needed
    if (isPDF) {
      setBlobUrl(null);
      setDocxHtml('');
      setTxtContent('');
      return;
    }

    let revoke = '';
    setIsLoading(true);

    const fetchDoc = async () => {
      try {
        const res = await fetch(apiUrl(`/documents/${activeDoc.id}/content`), {
          headers: authHeaders(authToken)
        });
        if (!res.ok) throw new Error('Failed to fetch');

        if (filename.endsWith('.docx')) {
          const buf = await res.arrayBuffer();
          const result = await mammoth.convertToHtml({ arrayBuffer: buf });
          setDocxHtml(result.value);
          setTxtContent('');
          setBlobUrl(null);
        } else if (filename.endsWith('.txt') || filename.endsWith('.md') || filename.endsWith('.csv')) {
          // Render as formatted plain text (covers Google Docs synced as .txt)
          const text = await res.text();
          setTxtContent(text);
          setDocxHtml('');
          setBlobUrl(null);
        } else {
          // Generic fallback: iframe
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          revoke = url;
          setBlobUrl(url);
          setTxtContent('');
          setDocxHtml('');
        }
      } catch (err) {
        console.error('DocumentViewer: fetch error', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoc();

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [activeDoc?.id, authToken]);

  if (!activeDoc) return null;

  const filename = activeDoc.filename.toLowerCase();
  const isPDF = filename.endsWith('.pdf');
  const isDocx = filename.endsWith('.docx');
  const isTxt = filename.endsWith('.txt') || filename.endsWith('.md') || filename.endsWith('.csv');

  const pdfFile = React.useMemo(() => ({
    url: apiUrl(`/documents/${activeDoc.id}/content`),
    httpHeaders: authHeaders(authToken)
  }), [activeDoc.id, authToken]);

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Tab bar */}
      <div className="flex border-b border-border p-2 gap-2 overflow-x-auto custom-scrollbar flex-shrink-0">
        {documents.map(doc => (
          <button
            key={doc.id}
            onClick={() => onDocumentChange?.(doc.id)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeDoc.id === doc.id
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <FileText size={12} />
            {/* Show clean name for Google Docs synced as .docx */}
            {doc.filename.endsWith('.docx') && doc.google_doc_id
              ? doc.filename.replace(/\.docx$/, '')
              : doc.filename}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="document-viewer-content-area flex-1 overflow-y-auto relative p-4 bg-muted/20 flex justify-center custom-scrollbar">

        {/* Quote popup — appears above any text selection */}
        {selection && (
          <div
            style={{ position: 'fixed', top: selection.top - 44, left: selection.left, transform: 'translateX(-50%)', zIndex: 9999 }}
            className="animate-in fade-in zoom-in-95 duration-150"
          >
            <button
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onQuoteSelect?.(selection.text);
                setSelection(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="quote-popup-btn flex items-center gap-1.5 bg-accent text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xl shadow-accent/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <MessageSquareQuote size={12} /> Quote
            </button>
          </div>
        )}

        {/* ── Renderers ── */}
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-accent" size={28} />
          </div>
        ) : isPDF ? (
          <Document
            file={pdfFile}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-accent mt-10" /></div>}
            className="flex flex-col items-center"
          >
            {Array.from({ length: numPages || 0 }, (_, index) => (
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
            className="w-full h-fit bg-white text-black p-8 rounded-xl shadow-2xl document-html-viewer prose max-w-none select-text selection:bg-accent/30 selection:text-black"
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        ) : isTxt && txtContent ? (
          <PlainTextRenderer content={txtContent} />
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
