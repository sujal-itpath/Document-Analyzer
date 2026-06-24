import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Edit2, Save, X, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface AcceptanceCriteria {
  given: string[];
  when: string[];
  then: string[];
}

export interface TestCase {
  id: string;
  title: string;
  type: string;
  priority: string;
  tags: string[];
  linked_requirement?: string;
  acceptance_criteria: AcceptanceCriteria;
  db_id?: int; // Optional db_id if we fetch from history
}

export interface TestCaseResponseData {
  filename: string;
  test_type: string;
  total_cases: number;
  citations: number[];
  test_cases: Record<string, TestCase[]>;
}

interface TestCasesPanelProps {
  documents: { id: number; filename: string; }[];
  projectId?: number;
  testCasesData?: TestCaseResponseData | null;
  onGenerateTestCases?: (filename: string, testType: string) => Promise<TestCaseResponseData>;
}

export default function TestCasesPanel({ documents, projectId, testCasesData: initialData, onGenerateTestCases }: TestCasesPanelProps) {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [currentData, setCurrentData] = useState<TestCaseResponseData | null>(initialData || null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedCases, setExpandedCases] = useState<Record<string, boolean>>({});
  
  // Edit state
  const [editingCase, setEditingCase] = useState<string | null>(null); // TC ID
  const [editForm, setEditForm] = useState<TestCase | null>(null);
  const [editGiven, setEditGiven] = useState('');
  const [editWhen, setEditWhen] = useState('');
  const [editThen, setEditThen] = useState('');

  useEffect(() => {
    if (initialData) {
      setCurrentData(initialData);
      setActiveTab('current');
      // Expand all modules by default
      const initialExpanded: Record<string, boolean> = {};
      Object.keys(initialData.test_cases).forEach(mod => {
        initialExpanded[mod] = true;
      });
      setExpandedModules(initialExpanded);
    }
  }, [initialData]);

  const fetchHistory = async () => {
    if (!token || documents.length === 0) return;
    setIsLoadingHistory(true);
    try {
      const filename = documents[0].filename; // Just use first doc for history
      const res = await fetch(`http://localhost:8000/test-cases/history?filename=${encodeURIComponent(filename)}&project_id=${projectId || ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch test case history', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, documents, projectId, token]);

  const toggleModule = (moduleName: string) => {
    setExpandedModules(prev => ({ ...prev, [moduleName]: !prev[moduleName] }));
  };

  const toggleTestCase = (tcId: string) => {
    setExpandedCases(prev => ({ ...prev, [tcId]: !prev[tcId] }));
  };

  const startEdit = (tc: TestCase) => {
    setEditingCase(tc.id);
    setEditForm(JSON.parse(JSON.stringify(tc))); // deep copy
    setEditGiven(tc.acceptance_criteria.given?.join('\n') || '');
    setEditWhen(tc.acceptance_criteria.when?.join('\n') || '');
    setEditThen(tc.acceptance_criteria.then?.join('\n') || '');
  };

  const cancelEdit = () => {
    setEditingCase(null);
    setEditForm(null);
  };

  const saveEdit = async (moduleName: string) => {
    if (!editForm || !currentData) return;
    
    const updatedGiven = editGiven.split('\n').map(s => s.trim()).filter(Boolean);
    const updatedWhen = editWhen.split('\n').map(s => s.trim()).filter(Boolean);
    const updatedThen = editThen.split('\n').map(s => s.trim()).filter(Boolean);

    if (editForm.db_id && token) {
      try {
        const payload = {
          title: editForm.title,
          priority: editForm.priority,
          tags: editForm.tags,
          acceptance_criteria: {
            given: updatedGiven,
            when: updatedWhen,
            then: updatedThen
          }
        };
        const res = await fetch(`http://localhost:8000/test-cases/${editForm.db_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          console.error("Failed to update test case on backend");
        }
      } catch (e) {
        console.error('Error updating test case', e);
      }
    }
    
    const newData = { ...currentData };
    const cases = newData.test_cases[moduleName];
    const idx = cases.findIndex(c => c.id === editForm.id);
    if (idx !== -1) {
      const updatedForm = { ...editForm };
      updatedForm.acceptance_criteria.given = updatedGiven;
      updatedForm.acceptance_criteria.when = updatedWhen;
      updatedForm.acceptance_criteria.then = updatedThen;
      cases[idx] = updatedForm;
      setCurrentData(newData);
    }
    setEditingCase(null);
    setEditForm(null);
  };

  const renderTestCase = (tc: TestCase, moduleName: string) => {
    if (editingCase === tc.id && editForm) {
      return (
        <div key={tc.id} className="border border-white/10 bg-[#0a0a0a] rounded-xl p-4 my-3 text-sm">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-blue-500">{tc.id}</h4>
            <div className="flex gap-2">
              <button onClick={cancelEdit} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors">
                <X size={14} />
              </button>
              <button onClick={() => saveEdit(moduleName)} className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors">
                <Save size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Title</label>
              <input 
                type="text" 
                value={editForm.title} 
                onChange={e => setEditForm({...editForm, title: e.target.value})}
                className="w-full bg-[#111] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Priority</label>
                <select 
                  value={editForm.priority}
                  onChange={e => setEditForm({...editForm, priority: e.target.value})}
                  className="w-full bg-[#111] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Given (one per line)</label>
              <textarea
                value={editGiven}
                onChange={e => setEditGiven(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white min-h-[60px]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">When (one per line)</label>
              <textarea
                value={editWhen}
                onChange={e => setEditWhen(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white min-h-[60px]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Then (one per line)</label>
              <textarea
                value={editThen}
                onChange={e => setEditThen(e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-md px-3 py-1.5 text-sm text-white min-h-[60px]"
              />
            </div>
          </div>
        </div>
      );
    }

    const isExpanded = expandedCases[tc.id];

    return (
      <div key={tc.id} className="border border-white/10 bg-[#0f0f0f] rounded-xl my-3 text-sm transition-colors group overflow-hidden">
        <div 
          className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => toggleTestCase(tc.id)}
        >
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              {/* <div className="mt-1 w-[14px] h-[14px] rounded-full border border-gray-600 flex-shrink-0 flex items-center justify-center bg-[#1a1a1a]">
                {isExpanded && <div className="w-[8px] h-[8px] rounded-full bg-blue-500" />}
              </div> */}
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  {/* <span className="font-bold text-blue-500 text-sm tracking-wide">{tc.id}</span> */}
                  <div className="font-bold text-white text-[15px] leading-snug">{tc.title}</div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${tc.priority.toLowerCase() === 'high' ? 'bg-[#450a0a] text-red-500' : tc.priority.toLowerCase() === 'medium' ? 'bg-[#422006] text-yellow-500' : 'bg-[#052e16] text-green-500'}`}>
                    {tc.priority}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); startEdit(tc); }}
              className="p-1.5 hover:bg-white/10 rounded text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Edit2 size={15} />
            </button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="border-t border-white/10 px-5 py-5 text-[14px] bg-[#000000]">
            <div className="space-y-5">
              {tc.acceptance_criteria.given && tc.acceptance_criteria.given.length > 0 && (
                <div>
                  <h5 className="font-bold text-gray-300 mb-2">Given</h5>
                  <ul className="list-disc pl-5 space-y-1 text-gray-200 marker:text-gray-500">
                    {tc.acceptance_criteria.given.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {tc.acceptance_criteria.when && tc.acceptance_criteria.when.length > 0 && (
                <div>
                  <h5 className="font-bold text-blue-400 mb-2">When</h5>
                  <ul className="list-disc pl-5 space-y-1 text-gray-200 marker:text-gray-500">
                    {tc.acceptance_criteria.when.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {tc.acceptance_criteria.then && tc.acceptance_criteria.then.length > 0 && (
                <div>
                  <h5 className="font-bold text-green-400 mb-2">Then</h5>
                  <ul className="list-disc pl-5 space-y-1 text-gray-200 marker:text-gray-500">
                    {tc.acceptance_criteria.then.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-white border-l border-white/10">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#111] flex-shrink-0">
        <div>
          <h2 className="font-black text-lg text-white">Test Cases</h2>
          <p className="text-xs text-gray-400 font-medium">
            AI-generated BDD test cases
          </p>
        </div>
        <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-white/5">
          <button 
            onClick={() => setActiveTab('current')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${activeTab === 'current' ? 'bg-[#333] shadow-sm text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Current
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${activeTab === 'history' ? 'bg-[#333] shadow-sm text-white' : 'text-gray-400 hover:text-white'}`}
          >
            History
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {activeTab === 'current' ? (
          currentData ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-gray-400">Generated <span className="font-black text-white">{currentData.total_cases}</span> cases for <span className="font-bold text-white">{currentData.filename}</span></span>
                <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-md text-xs font-bold uppercase">{currentData.test_type}</span>
              </div>
              
              <div className="space-y-6">
                {Object.entries(currentData.test_cases).map(([moduleName, cases]) => (
                  <div key={moduleName} className="mb-6">
                    <button 
                      onClick={() => toggleModule(moduleName)}
                      className="w-full flex items-center justify-between py-2 text-white hover:text-gray-300 transition-colors group"
                    >
                      <span className="font-black text-base">{moduleName} <span className="text-gray-500 font-normal">({cases.length})</span></span>
                      {expandedModules[moduleName] ? <ChevronDown size={18} className="text-gray-500 group-hover:text-gray-300 transition-colors" /> : <ChevronRight size={18} className="text-gray-500 group-hover:text-gray-300 transition-colors" />}
                    </button>
                    {expandedModules[moduleName] && (
                      <div className="pt-2">
                        {cases.map(tc => renderTestCase(tc, moduleName))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm p-6 text-center">
              <FileText size={48} className="opacity-20 mb-4" />
              <p>No test cases generated yet.</p>
              <p className="mt-2 text-xs opacity-70">Use the chat interface to generate test cases from your document.</p>
            </div>
          )
        ) : (
          <div>
            {isLoadingHistory ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-accent" /></div>
            ) : history.length > 0 ? (
              <div className="space-y-4">
                {history.map(run => (
                  <div key={run.run_id} className="border border-border rounded-xl p-4 bg-card">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-sm">{run.filename}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(run.created_at).toLocaleString()}</div>
                    </div>
                    <div className="flex gap-3 text-xs mb-3">
                      <span className="bg-accent/10 text-accent px-2 py-0.5 rounded font-bold">{run.test_type}</span>
                      <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded">{run.total_cases} cases</span>
                    </div>
                    <button 
                      onClick={() => {
                        setCurrentData({
                          filename: run.filename,
                          test_type: run.test_type,
                          total_cases: run.total_cases,
                          citations: [],
                          test_cases: run.test_cases
                        });
                        setActiveTab('current');
                      }}
                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                    >
                      <RefreshCw size={12} /> Load this run
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground text-sm py-10">No history found for this document.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
