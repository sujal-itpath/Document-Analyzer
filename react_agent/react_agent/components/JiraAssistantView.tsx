import React, { useState, useEffect, useRef } from 'react';
import { apiUrl, authHeaders } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, ArrowLeft, Kanban, CheckCircle2, ChevronRight, Send, AlertCircle, RefreshCw } from 'lucide-react';

interface JiraAssistantViewProps {
  onBack: () => void;
  projectId?: number;
}

type JiraProject = {
  id: string;
  key: string;
  name: string;
  avatarUrls: any;
};

type JiraIssueType = {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
};

type ChatMessage = {
  id: string;
  role: 'agent' | 'user';
  content: string;
  options?: string[];
  allowCustomInput?: boolean;
};

const JiraAssistantView: React.FC<JiraAssistantViewProps> = ({ onBack, projectId }) => {
  const { token } = useAuth();
  const [step, setStep] = useState<'setup' | 'chat' | 'draft'>('setup');
  
  // Setup State
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [issueTypes, setIssueTypes] = useState<JiraIssueType[]>([]);
  const [selectedProject, setSelectedProject] = useState<JiraProject | null>(null);
  const [selectedIssueType, setSelectedIssueType] = useState<JiraIssueType | null>(null);
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (step === 'chat') scrollToBottom();
  }, [messages, step]);

  // Fetch Projects on Mount
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoadingSetup(true);
      setSetupError(null);
      try {
        const res = await fetch(apiUrl('/jira/projects'), { headers: authHeaders(token) });
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
        } else {
          const err = await res.json();
          setSetupError(err.detail || 'Failed to load projects');
        }
      } catch (err) {
        setSetupError('Network error loading projects');
      } finally {
        setIsLoadingSetup(false);
      }
    };
    fetchProjects();
  }, [token]);

  // Fetch Issue Types when Project selected
  useEffect(() => {
    const fetchIssueTypes = async () => {
      if (!selectedProject) {
        setIssueTypes([]);
        return;
      }
      setIsLoadingSetup(true);
      setSetupError(null);
      try {
        const res = await fetch(apiUrl(`/jira/projects/${selectedProject.key}/issue_types`), { headers: authHeaders(token) });
        if (res.ok) {
          const data = await res.json();
          setIssueTypes(data.issue_types || []);
          setSelectedIssueType(null);
        } else {
          setSetupError('Failed to load issue types');
        }
      } catch (err) {
        setSetupError('Network error loading issue types');
      } finally {
        setIsLoadingSetup(false);
      }
    };
    fetchIssueTypes();
  }, [selectedProject, token]);

  const handleStartChat = async () => {
    if (!selectedProject || !selectedIssueType) return;
    
    setStep('chat');
    setIsTyping(true);
    setMessages([]);
    
    try {
      const res = await fetch(apiUrl('/jira/draft/start'), {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: selectedProject.id,
          issue_type: selectedIssueType.name,
          workspace_project_id: projectId
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        
        // Add AI first message
        setMessages([
          {
            id: Date.now().toString(),
            role: 'agent',
            content: data.question,
            options: data.options,
            allowCustomInput: data.allowCustomInput
          }
        ]);
      } else {
        setSetupError("Failed to initialize AI assistant.");
        setStep('setup');
      }
    } catch (err) {
      setSetupError("Network error starting chat.");
      setStep('setup');
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !sessionId) return;
    
    // Add user message immediately
    const newMessages: ChatMessage[] = [
      ...messages,
      { id: Date.now().toString(), role: 'user', content: text }
    ];
    setMessages(newMessages);
    setInputValue("");
    setIsTyping(true);
    
    try {
      const res = await fetch(apiUrl('/jira/draft/ask'), {
        method: 'POST',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: sessionId,
          answer: text
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.status === 'ready_for_generation') {
          // Move to Draft Review
          setStep('draft');
        } else {
          setMessages([
            ...newMessages,
            {
              id: (Date.now() + 1).toString(),
              role: 'agent',
              content: data.question,
              options: data.options,
              allowCustomInput: data.allowCustomInput
            }
          ]);
        }
      }
    } catch (err) {
      console.error("Chat error", err);
    } finally {
      setIsTyping(false);
    }
  };

  // Review State
  const [ticketDraft, setTicketDraft] = useState<any>(null);
  const [testCases, setTestCases] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{id: string, url: string} | null>(null);

  const handleGenerateTicket = async () => {
    if (!sessionId) return;
    setIsGenerating(true);
    try {
      const res = await fetch(apiUrl('/jira/draft/generate'), {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, workspace_project_id: projectId })
      });
      if (res.ok) {
        const data = await res.json();
        setTicketDraft(data.ticket);
        setTestCases(data.test_cases);
      } else {
        setSetupError("Failed to generate ticket.");
      }
    } catch (err) {
      setSetupError("Network error generating ticket.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (step === 'draft' && !ticketDraft && !isGenerating) {
      handleGenerateTicket();
    }
  }, [step]);

  const handleReviseTests = async () => {
    if (!sessionId || !ticketDraft?.acceptance_criteria) return;
    setIsRevising(true);
    try {
      const res = await fetch(apiUrl('/jira/draft/revise_tests'), {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, acceptance_criteria: ticketDraft.acceptance_criteria })
      });
      if (res.ok) {
        const data = await res.json();
        setTestCases(data.test_cases);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRevising(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!sessionId || !ticketDraft) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(apiUrl('/jira/draft/submit'), {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          summary: ticketDraft.summary,
          description: ticketDraft.description,
          acceptance_criteria: ticketDraft.acceptance_criteria,
          test_cases: testCases
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSubmitSuccess({ id: data.ticket_key, url: data.ticket_url });
      } else {
        setSetupError("Failed to submit ticket to Jira.");
      }
    } catch (err) {
      setSetupError("Network error submitting ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background relative z-0 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
            title="Back to Connectors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 bg-[#0052CC] rounded-xl shadow-sm flex items-center justify-center p-2 flex-shrink-0 text-white">
            <Kanban size={20} />
          </div>
          <div>
            <h2 className="font-black text-lg">Jira AI Assistant</h2>
            <p className="text-xs text-muted-foreground font-medium">
              Generate high-quality tickets from context
            </p>
          </div>
        </div>
        {submitSuccess && (
          <a 
            href={submitSuccess.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-4 py-2 bg-[#0052CC]/10 text-[#0052CC] hover:bg-[#0052CC]/20 font-bold rounded-xl text-sm flex items-center gap-2 transition-all"
          >
            Open {submitSuccess.id} <ChevronRight size={16} />
          </a>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col bg-muted/20">
        {step === 'setup' && (
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex items-center justify-center">
            <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 shadow-xl">
              <h3 className="text-2xl font-black mb-6">Create New Ticket</h3>
              
              {setupError && (
                <div className="mb-6 p-4 rounded-xl flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold">
                  <AlertCircle size={16} /> {setupError}
                </div>
              )}
              
              {isLoadingSetup && projects.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-accent" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold mb-2">Select Project</label>
                    <div className="grid grid-cols-1 gap-2">
                      {projects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedProject(p)}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            selectedProject?.id === p.id 
                              ? 'border-accent bg-accent/5 ring-1 ring-accent' 
                              : 'border-border bg-background hover:border-accent/40'
                          }`}
                        >
                          {p.avatarUrls?.['24x24'] ? (
                            <img src={p.avatarUrls['24x24']} alt="" className="w-6 h-6 rounded-md" />
                          ) : (
                            <div className="w-6 h-6 bg-muted rounded-md" />
                          )}
                          <span className="font-semibold text-sm flex-1">{p.name} ({p.key})</span>
                          {selectedProject?.id === p.id && <CheckCircle2 size={16} className="text-accent" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedProject && (
                    <div className="animate-in slide-in-from-top-4 fade-in">
                      <label className="block text-sm font-bold mb-2">Issue Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {isLoadingSetup ? (
                          <div className="col-span-2 flex justify-center py-4">
                            <Loader2 size={24} className="animate-spin text-accent" />
                          </div>
                        ) : issueTypes.map(it => (
                          <button
                            key={it.id}
                            onClick={() => setSelectedIssueType(it)}
                            className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                              selectedIssueType?.id === it.id 
                                ? 'border-accent bg-accent/5 ring-1 ring-accent' 
                                : 'border-border bg-background hover:border-accent/40'
                            }`}
                          >
                            {it.iconUrl && <img src={it.iconUrl} alt="" className="w-4 h-4" />}
                            <span className="font-semibold text-xs flex-1">{it.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-4 border-t border-border mt-6">
                    <button
                      onClick={handleStartChat}
                      disabled={!selectedProject || !selectedIssueType || isLoadingSetup}
                      className="w-full py-3.5 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/30 hover:shadow-accent/50 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
                    >
                      Start AI Assistant <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {step === 'chat' && (
          <div className="flex-1 flex flex-col h-full max-w-3xl mx-auto w-full border-x border-border bg-card">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((m, idx) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${m.role === 'user' ? 'order-1' : 'order-2'}`}>
                    <div className={`p-4 rounded-2xl text-sm ${
                      m.role === 'user' 
                        ? 'bg-accent text-white rounded-tr-sm shadow-md' 
                        : 'bg-muted text-foreground rounded-tl-sm border border-border'
                    }`}>
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                    
                    {/* Render intelligent options for agent messages */}
                    {m.role === 'agent' && m.options && m.options.length > 0 && idx === messages.length - 1 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(opt)}
                            className="px-4 py-2 bg-background border border-accent/30 hover:border-accent hover:bg-accent/5 rounded-xl text-xs font-bold transition-all text-accent shadow-sm"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm border border-border p-4 shadow-sm flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            {(!messages.length || messages[messages.length - 1]?.allowCustomInput !== false) && (
              <div className="p-4 bg-background border-t border-border">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputValue); }}
                  className="flex gap-2 relative"
                >
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your answer here..."
                    className="flex-1 bg-muted border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                    disabled={isTyping}
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isTyping}
                    className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-accent text-white rounded-lg flex items-center justify-center transition-all disabled:opacity-50 hover:bg-accent/90"
                  >
                    <Send size={16} className={inputValue.trim() && !isTyping ? "translate-x-0.5" : ""} />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {step === 'draft' && (
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
             {isGenerating || !ticketDraft ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-accent/20 blur-xl rounded-full" />
                    <Loader2 size={48} className="animate-spin text-accent relative z-10" />
                  </div>
                  <h3 className="text-xl font-black mt-6 mb-2">Drafting Your Ticket</h3>
                  <p className="text-muted-foreground">The AI is compiling context and generating test cases...</p>
                </div>
             ) : (
               <div className="max-w-4xl mx-auto space-y-6">
                 {setupError && (
                    <div className="p-4 rounded-xl flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-bold">
                      <AlertCircle size={16} /> {setupError}
                    </div>
                 )}
                 {submitSuccess && (
                    <div className="p-4 rounded-xl flex items-center justify-between bg-green-500/10 border border-green-500/20 text-green-600">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={20} />
                        <div>
                          <p className="font-bold">Ticket created successfully!</p>
                          <p className="text-sm">Your test cases were added as a comment.</p>
                        </div>
                      </div>
                      <button onClick={() => setStep('setup')} className="px-4 py-2 bg-background border border-border hover:bg-muted font-bold rounded-lg text-sm text-foreground transition-all shadow-sm">
                        Create Another
                      </button>
                    </div>
                 )}
                 <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-lg">
                    <div className="p-6 border-b border-border bg-muted/30">
                      <h3 className="font-black text-lg mb-4">Ticket Preview</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Summary</label>
                          <input 
                            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
                            value={ticketDraft.summary}
                            onChange={e => setTicketDraft({...ticketDraft, summary: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Description</label>
                          <textarea 
                            className="w-full h-32 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all custom-scrollbar resize-y"
                            value={ticketDraft.description}
                            onChange={e => setTicketDraft({...ticketDraft, description: e.target.value})}
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Acceptance Criteria</label>
                            <button 
                              onClick={handleReviseTests}
                              disabled={isRevising || !ticketDraft.acceptance_criteria}
                              className="text-[10px] bg-accent/10 text-accent hover:bg-accent/20 px-2 py-1 rounded-md font-bold transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              {isRevising ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />} Update Tests
                            </button>
                          </div>
                          <textarea 
                            className="w-full h-24 bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all custom-scrollbar resize-y"
                            value={ticketDraft.acceptance_criteria}
                            onChange={e => setTicketDraft({...ticketDraft, acceptance_criteria: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">QA Test Cases</label>
                          <textarea 
                            className="w-full h-48 bg-muted border border-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all custom-scrollbar resize-y"
                            value={testCases}
                            onChange={e => setTestCases(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-4 bg-background flex justify-end gap-3">
                       <button
                         onClick={() => setStep('setup')}
                         className="px-6 py-2 border border-border hover:bg-muted text-foreground font-bold rounded-xl text-sm transition-all shadow-sm"
                       >
                         Cancel
                       </button>
                       <button
                         onClick={handleSubmitTicket}
                         disabled={isSubmitting || !!submitSuccess}
                         className="px-6 py-2 bg-[#0052CC] text-white hover:bg-[#0052CC]/90 shadow-lg shadow-[#0052CC]/30 font-bold rounded-xl text-sm flex items-center gap-2 transition-all disabled:opacity-50"
                       >
                         {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : "Create Jira Ticket"}
                       </button>
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

export default JiraAssistantView;
