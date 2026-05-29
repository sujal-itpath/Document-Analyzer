import React, { useState } from 'react';
import { Bookmark, Loader2, Sparkles, Pencil, Check, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from './ui/Dialog';

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
  generation_status?: string;
}

interface TestCaseCardProps {
  testCase: TestCase;
  filename: string;
  onUpdate: (updatedTc: TestCase) => void;
}

export const TestCaseCard: React.FC<TestCaseCardProps> = ({ testCase, filename, onUpdate }) => {
  const { token } = useAuth();
  const dialog = useDialog();

  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingAI, setIsUpdatingAI] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [editedTc, setEditedTc] = useState<TestCase>(testCase);

  const [editGiven, setEditGiven] = useState('');
  const [editWhen, setEditWhen] = useState('');
  const [editThen, setEditThen] = useState('');

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

  const getStatusColor = (status: string | undefined) => {
    if (!status || status === 'AI Generated') {
      return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
    } else if (status === 'User Updated') {
      return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
    } else if (status === 'AI Updated') {
      return 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20';
    }
    return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
  };

  const handleEditClick = () => {
    setEditedTc(testCase);
    setEditGiven(testCase.acceptance_criteria.given.join('\n'));
    setEditWhen(testCase.acceptance_criteria.when.join('\n'));
    setEditThen(testCase.acceptance_criteria.then.join('\n'));
    setIsEditing(true);
  };

  const handleManualSave = () => {
    const updatedTc = {
      ...editedTc,
      generation_status: 'User Updated',
      acceptance_criteria: {
        given: editGiven.split('\n').filter(s => s.trim()),
        when: editWhen.split('\n').filter(s => s.trim()),
        then: editThen.split('\n').filter(s => s.trim()),
      }
    };
    onUpdate(updatedTc);
    setIsEditing(false);
  };

  const handleAIUpdate = async (instruction: string) => {
    setIsUpdatingAI(true);
    setShowAiMenu(false);
    
    try {
      const res = await fetch('http://localhost:8000/test-cases/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename,
          test_case: testCase,
          instruction: instruction,
        }),
      });

      const responseJSON = await res.json();

      if (res.ok && responseJSON.data) {
        onUpdate({
          ...responseJSON.data,
          generation_status: 'AI Updated',
        });
      } else {
        await dialog.alert({
          title: 'Update Failed',
          message: responseJSON.detail || 'An error occurred during AI update.',
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
      setIsUpdatingAI(false);
    }
  };

  if (isEditing) {
    return (
      <div className="bg-card border border-accent/40 p-5 rounded-[24px] space-y-4 shadow-lg transition-all">
        <div className="flex flex-col gap-3">
          <input
            value={editedTc.title}
            onChange={(e) => setEditedTc({ ...editedTc, title: e.target.value })}
            className="text-sm font-black text-foreground bg-muted/50 border border-border rounded-lg px-3 py-2 focus:border-accent outline-none w-full"
            placeholder="Test Case Title"
          />
          <div className="flex gap-2">
            <select
              value={editedTc.priority}
              onChange={(e) => setEditedTc({ ...editedTc, priority: e.target.value })}
              className="text-xs bg-muted/50 border border-border rounded-lg px-3 py-2 focus:border-accent outline-none"
            >
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
            <input
              value={editedTc.type}
              onChange={(e) => setEditedTc({ ...editedTc, type: e.target.value })}
              className="text-xs bg-muted/50 border border-border rounded-lg px-3 py-2 focus:border-accent outline-none w-32"
              placeholder="Type (e.g. Manual)"
            />
          </div>

          <div className="space-y-2 mt-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Given</label>
            <textarea
              value={editGiven}
              onChange={(e) => setEditGiven(e.target.value)}
              className="w-full text-xs bg-muted/50 border border-border rounded-lg px-3 py-2 min-h-[60px] focus:border-accent outline-none"
            />
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">When</label>
            <textarea
              value={editWhen}
              onChange={(e) => setEditWhen(e.target.value)}
              className="w-full text-xs bg-muted/50 border border-border rounded-lg px-3 py-2 min-h-[60px] focus:border-accent outline-none"
            />
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Then</label>
            <textarea
              value={editThen}
              onChange={(e) => setEditThen(e.target.value)}
              className="w-full text-xs bg-muted/50 border border-border rounded-lg px-3 py-2 min-h-[60px] focus:border-accent outline-none"
            />
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleManualSave} className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-xl text-xs font-black shadow-lg shadow-accent/20">
              <Check size={14} /> Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  const aiPresets = [
    { label: 'Refine Steps', prompt: 'Refine and improve the clarity of the Given/When/Then steps.' },
    { label: 'Add Negative Paths', prompt: 'Add error handling and negative test paths to this scenario.' },
    { label: 'Make Edge Case', prompt: 'Modify this test case to cover an extreme edge case.' },
  ];

  return (
    <div className="bg-card border border-border p-5 rounded-[24px] space-y-4 hover:border-accent/40 hover:shadow-lg transition-all group relative">
      {/* Top right actions - visible on hover */}
      <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity gap-2">
        <div className="relative">
          {/* <button
            onClick={() => setShowAiMenu(!showAiMenu)}
            disabled={isUpdatingAI}
            className="p-1.5 bg-muted text-accent hover:bg-accent hover:text-white rounded-lg transition-colors border border-border shadow-sm flex items-center gap-1 text-[10px] font-bold"
          >
            {isUpdatingAI ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            AI Update
          </button> */}
          {showAiMenu && (
            <div className="absolute right-0 top-full mt-2 w-40 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-10 flex flex-col">
              {aiPresets.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAIUpdate(preset.prompt)}
                  className="px-3 py-2 text-left text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 border-b border-border/40 last:border-0"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleEditClick}
          className="p-1.5 bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors border border-border shadow-sm"
        >
          <Pencil size={12} />
        </button>
      </div>

      {/* TestCase Header */}
      <div className="flex items-start justify-between gap-4 pr-28">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${getStatusColor(testCase.generation_status)}`}>
              {testCase.generation_status || 'AI Generated'}
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${getPriorityColor(testCase.priority)}`}>
              {testCase.priority} Priority
            </span>
          </div>
          <h4 className="text-sm font-black text-foreground">{testCase.title}</h4>
        </div>
      </div>

      {/* Acceptance criteria */}
      <div className={`bg-muted/30 border border-border/40 rounded-2xl p-4 space-y-3.5 ${isUpdatingAI ? 'opacity-50 grayscale transition-all' : ''}`}>
        {testCase.acceptance_criteria.given.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">
              Given (Preconditions)
            </span>
            <ul className="space-y-1.5 pl-0.5">
              {testCase.acceptance_criteria.given.map((item, idx) => (
                <li key={idx} className="text-xs font-medium text-foreground flex items-start gap-2">
                  <span className="text-blue-500 font-bold mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {testCase.acceptance_criteria.when.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">
              When (Trigger Actions)
            </span>
            <ul className="space-y-1.5 pl-0.5">
              {testCase.acceptance_criteria.when.map((item, idx) => (
                <li key={idx} className="text-xs font-medium text-foreground flex items-start gap-2">
                  <span className="text-amber-500 font-bold mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {testCase.acceptance_criteria.then.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 block">
              Then (Expected Results)
            </span>
            <ul className="space-y-1.5 pl-0.5">
              {testCase.acceptance_criteria.then.map((item, idx) => (
                <li key={idx} className="text-xs font-medium text-foreground flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
