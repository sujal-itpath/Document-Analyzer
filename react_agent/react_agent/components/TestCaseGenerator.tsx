import React, { useState, useEffect } from 'react';
import {
  FileText, Sparkles, Loader2, Play, Download, Copy, Check,
  ChevronRight, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2,
  Bookmark, ShieldAlert, Zap, Globe, Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from './ui/Dialog';

interface Document {
  id: number;
  filename: string;
  summary?: string;
  suggestions?: string;
}

interface TestCaseGeneratorProps {
  projectId?: number;
  preSelectedDocFilename?: string | null;
  onBackToHome: () => void;
}

interface AcceptanceCriteria {
  given: string[];
  when: string[];
  then: string[];
}

interface TestCase {
  id: string;
  title: string;
  type: string;
  priority: string;
  tags?: string[];
  linked_requirement?: string;
  acceptance_criteria: AcceptanceCriteria;
}

interface TestCaseResponse {
  filename: string;
  test_type: string;
  total_cases: number;
  citations: number[];
  test_cases: Record<string, TestCase[]>;
}

const TEST_TYPES = [
  { id: 'Manual', title: 'Manual BDD', icon: Bookmark, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', desc: 'UI interactions, forms, validation, and standard user journeys.' },
  { id: 'API', title: 'API/Integration', icon: Globe, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', desc: 'Endpoints, HTTP payloads, status codes, and error payloads.' },
  { id: 'Smoke', title: 'Smoke Test', icon: Zap, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', desc: 'Top 5-10 critical user paths to verify basic build sanity.' },
  { id: 'Regression', title: 'Regression', icon: Layers, color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', desc: 'Edge cases, validations, permission roles, and safety nets.' },
  { id: 'All', title: 'Comprehensive Mix', icon: Sparkles, color: 'text-pink-500 bg-pink-500/10 border-pink-500/20', desc: 'A rich mixture of Manual, API, and critical Smoke tests.' },
];

const LOADING_STEPS = [
  'Establishing connection to ChromaDB...',
  'Extracting relevant requirement chunks and pages...',
  'Structuring context with page numbers...',
  'Consulting Gemini to identify application modules...',
  'Generating BDD Given/When/Then scenarios...',
  'Validating JSON outputs against typing rules...',
  'Polishing priorities and assigning search tags...',
];

const TestCaseGenerator = ({
  projectId,
  preSelectedDocFilename = null,
  onBackToHome,
}: TestCaseGeneratorProps) => {
  const { token } = useAuth();
  const dialog = useDialog();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedFilename, setSelectedFilename] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('Manual');
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  // Response state
  const [results, setResults] = useState<TestCaseResponse | null>(null);
  const [activeModule, setActiveModule] = useState<string>('');

  useEffect(() => {
    fetchDocuments();
  }, [projectId]);

  useEffect(() => {
    if (preSelectedDocFilename) {
      setSelectedFilename(preSelectedDocFilename);
    } else if (documents.length > 0 && !selectedFilename) {
      setSelectedFilename(documents[0].filename);
    }
  }, [preSelectedDocFilename, documents]);

  // Loading animation step timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGenerating) {
      timer = setInterval(() => {
        setLoadingStepIdx((prev) => (prev + 1) % LOADING_STEPS.length);
      }, 3000);
    } else {
      setLoadingStepIdx(0);
    }
    return () => clearInterval(timer);
  }, [isGenerating]);

  const fetchDocuments = async () => {
    try {
      setIsLoadingDocs(true);
      const url = projectId
        ? `http://localhost:8000/documents?project_id=${projectId}`
        : 'http://localhost:8000/documents';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
        if (data.length > 0 && !selectedFilename && !preSelectedDocFilename) {
          setSelectedFilename(data[0].filename);
        }
      }
    } catch (err) {
      console.error('Failed to load documents', err);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedFilename) return;
    setIsGenerating(true);
    setResults(null);

    try {
      const res = await fetch('http://localhost:8000/test-cases/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: selectedFilename,
          test_type: selectedType,
        }),
      });

      const responseJSON = await res.json();

      if (res.ok && responseJSON.data) {
        const data: TestCaseResponse = responseJSON.data;
        setResults(data);
        const modules = Object.keys(data.test_cases);
        if (modules.length > 0) {
          setActiveModule(modules[0]);
        }
      } else {
        await dialog.alert({
          title: 'Generation Failed',
          message: responseJSON.detail || 'An error occurred during test case generation.',
          variant: 'danger',
        });
      }
    } catch (err) {
      await dialog.alert({
        title: 'Network Error',
        message: 'Could not connect to the backend server. Please try again.',
        variant: 'danger',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!results) return;
    navigator.clipboard.writeText(JSON.stringify(results.test_cases, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    if (!results) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Module,Test ID,Title,Type,Priority,Tags,Linked Requirement,Given,When,Then\r\n';

    Object.entries(results.test_cases).forEach(([modName, testCases]) => {
      testCases.forEach((tc) => {
        const given = tc.acceptance_criteria.given.join('; ');
        const when = tc.acceptance_criteria.when.join('; ');
        const then = tc.acceptance_criteria.then.join('; ');
        const tags = tc.tags ? tc.tags.join(', ') : '';
        const requirement = tc.linked_requirement || '';

        const row = [
          `"${modName.replace(/"/g, '""')}"`,
          `"${tc.id}"`,
          `"${tc.title.replace(/"/g, '""')}"`,
          `"${tc.type}"`,
          `"${tc.priority}"`,
          `"${tags.replace(/"/g, '""')}"`,
          `"${requirement.replace(/"/g, '""')}"`,
          `"${given.replace(/"/g, '""')}"`,
          `"${when.replace(/"/g, '""')}"`,
          `"${then.replace(/"/g, '""')}"`,
        ].join(',');

        csvContent += row + '\r\n';
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${results.filename.split('.')[0]}_BDD_TestCases.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPriorityColor = (prio: string) => {
    switch (prio.toLowerCase()) {
      case 'high':
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'medium':
        return 'text-sky-500 bg-sky-500/10 border-sky-500/20';
      case 'low':
        return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
      default:
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  if (isLoadingDocs) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-accent" size={40} />
          <p className="text-sm text-muted-foreground font-bold">Loading workspace documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card/40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="font-black text-lg flex items-center gap-2">
              <Sparkles className="text-accent" size={18} />
              BDD Test Case Generator
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              Create and export Given/When/Then scenarios mapped to your requirement papers
            </p>
          </div>
        </div>
      </div>

      {/* Main Work Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {!results && !isGenerating && (
          <div className="max-w-4xl mx-auto space-y-8 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Input Selection Card */}
            <div className="bg-card border border-border p-6 rounded-[32px] space-y-6 shadow-xl shadow-black/5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
                  <FileText size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black mb-1">Select Requirement Document</h3>
                  <p className="text-xs text-muted-foreground">
                    Choose one of your uploaded files to analyze and extract test cases from.
                  </p>
                  
                  {documents.length === 0 ? (
                    <div className="mt-4 p-4 border border-dashed border-border rounded-2xl text-center">
                      <p className="text-sm font-bold text-muted-foreground">No documents indexed in this project yet.</p>
                      <button
                        onClick={onBackToHome}
                        className="mt-2 text-xs font-black text-accent hover:underline"
                      >
                        Upload some documents first
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedFilename}
                      onChange={(e) => setSelectedFilename(e.target.value)}
                      className="mt-4 w-full bg-muted/50 border border-border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-all font-bold text-foreground"
                    >
                      {documents.map((doc) => (
                        <option key={doc.id} value={doc.filename}>
                          {doc.filename}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* Test Type Select Cards */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-2">
                Select Generation Strategy
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEST_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = selectedType === type.id;
                  return (
                    <div
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      className={`cursor-pointer border-2 p-5 rounded-[28px] transition-all duration-300 flex items-start gap-4 ${
                        isSelected
                          ? 'border-accent bg-accent/5 shadow-xl shadow-accent/5'
                          : 'border-border bg-card hover:border-accent/40'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${type.color}`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-black block mb-1">{type.title}</span>
                        <span className="text-[11px] leading-relaxed text-muted-foreground block">
                          {type.desc}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleGenerate}
                disabled={!selectedFilename || documents.length === 0}
                className="flex items-center gap-2 bg-accent text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl shadow-accent/20 hover:shadow-2xl hover:shadow-accent/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <Play size={16} fill="white" />
                Generate BDD Test Cases
              </button>
            </div>
          </div>
        )}

        {/* Loading Screen */}
        {isGenerating && (
          <div className="h-[400px] flex items-center justify-center">
            <div className="max-w-md w-full bg-card border border-border p-8 rounded-[36px] flex flex-col items-center text-center space-y-6 shadow-2xl">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 bg-accent/10 rounded-full animate-ping duration-1000" />
                <div className="relative w-16 h-16 bg-accent rounded-3xl flex items-center justify-center text-white shadow-xl shadow-accent/30">
                  <Loader2 className="animate-spin" size={28} />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black">Generating BDD Test Matrix</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Our pipeline is reading ChromaDB contexts and prompting Gemini to format structured test specs. This may take 15-30 seconds.
                </p>
              </div>
              {/* Progress Stepper indicator */}
              <div className="w-full bg-muted/60 border border-border/40 rounded-xl p-3 flex items-center gap-2 text-left">
                <Sparkles className="text-accent shrink-0 animate-pulse" size={14} />
                <span className="text-[11px] font-bold text-foreground transition-all duration-300">
                  {LOADING_STEPS[loadingStepIdx]}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Result specs display */}
        {results && (
          <div className="h-full flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
            {/* Action Bar */}
            <div className="bg-card border border-border px-5 py-3.5 rounded-[24px] flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="text-accent" size={18} />
                <span className="text-xs font-black text-muted-foreground truncate max-w-[200px]" title={results.filename}>
                  {results.filename}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  {results.total_cases} cases
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 px-4 py-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl text-xs font-bold transition-all border border-border bg-background"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  {copied ? 'Copied JSON!' : 'Copy JSON'}
                </button>
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white hover:bg-accent/90 rounded-xl text-xs font-black transition-all border border-accent/10 shadow-lg shadow-accent/15"
                >
                  <Download size={14} />
                  Export CSV
                </button>
                <button
                  onClick={() => setResults(null)}
                  className="flex items-center gap-1.5 px-3 py-2 hover:bg-muted text-muted-foreground rounded-xl text-xs font-bold transition-colors"
                >
                  <RefreshCw size={14} />
                  New Spec
                </button>
              </div>
            </div>

            {/* Split panels layout */}
            <div className="flex-1 min-h-[450px] grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Left module pills sidebar */}
              <div className="bg-card/40 border border-border rounded-[28px] p-4 flex flex-col gap-1 overflow-y-auto">
                <span className="text-[9px] font-black tracking-[0.15em] text-muted-foreground/60 uppercase px-2 mb-2">
                  System Modules
                </span>
                {Object.entries(results.test_cases).map(([modName, testCases]) => {
                  const isActive = activeModule === modName;
                  return (
                    <button
                      key={modName}
                      onClick={() => setActiveModule(modName)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                        isActive
                          ? 'bg-accent/10 text-accent font-black border border-accent/20'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground font-bold'
                      } text-xs`}
                    >
                      <span className="truncate pr-2">{modName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md ${isActive ? 'bg-accent text-white font-bold' : 'bg-muted-foreground/15 text-muted-foreground'}`}>
                        {testCases.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right test cases display panel */}
              <div className="md:col-span-3 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                {results.test_cases[activeModule]?.map((tc) => (
                  <div
                    key={tc.id}
                    className="bg-card border border-border p-5 rounded-[24px] space-y-4 hover:border-accent/40 hover:shadow-lg transition-all"
                  >
                    {/* TestCase Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-black text-accent bg-accent/10 px-2 py-0.5 rounded-md border border-accent/15">
                            {tc.id}
                          </span>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${getPriorityColor(tc.priority)}`}>
                            {tc.priority} Priority
                          </span>
                          {tc.linked_requirement && (
                            <span className="text-[10px] font-bold text-muted-foreground/75 bg-muted/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Bookmark size={9} />
                              {tc.linked_requirement}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-foreground">{tc.title}</h4>
                      </div>
                    </div>

                    {/* Acceptance criteria Given/When/Then lists */}
                    <div className="bg-muted/30 border border-border/40 rounded-2xl p-4 space-y-3.5">
                      {tc.acceptance_criteria.given.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">
                            Given (Preconditions)
                          </span>
                          <ul className="space-y-1.5 pl-0.5">
                            {tc.acceptance_criteria.given.map((item, idx) => (
                              <li key={idx} className="text-xs font-medium text-foreground flex items-start gap-2">
                                <span className="text-blue-500 font-bold mt-0.5">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {tc.acceptance_criteria.when.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">
                            When (Trigger Actions)
                          </span>
                          <ul className="space-y-1.5 pl-0.5">
                            {tc.acceptance_criteria.when.map((item, idx) => (
                              <li key={idx} className="text-xs font-medium text-foreground flex items-start gap-2">
                                <span className="text-amber-500 font-bold mt-0.5">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {tc.acceptance_criteria.then.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">
                            Then (Expected Results)
                          </span>
                          <ul className="space-y-1.5 pl-0.5">
                            {tc.acceptance_criteria.then.map((item, idx) => (
                              <li key={idx} className="text-xs font-medium text-foreground flex items-start gap-2">
                                <span className="text-emerald-500 font-bold mt-0.5">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Tags */}
                    {tc.tags && tc.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {tc.tags.map((tag) => (
                          <span key={tag} className="text-[9px] font-black uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Citations Footer */}
            {results.citations && results.citations.length > 0 && (
              <div className="bg-card border border-border p-4 rounded-[20px] flex items-center gap-3 text-xs shadow-sm flex-shrink-0">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <div className="flex items-center gap-2">
                  <span className="font-black text-muted-foreground">Document Source Traceability:</span>
                  <div className="flex items-center gap-1">
                    {results.citations.map((page) => (
                      <span key={page} className="px-2 py-0.5 bg-muted/60 border border-border text-foreground font-bold rounded-md text-[10px]">
                        Page {page}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TestCaseGenerator;
