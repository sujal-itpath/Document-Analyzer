import React, { useState } from 'react';
import { X, Loader2, Link2 } from 'lucide-react';
import { apiUrl, authHeaders } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export interface JiraTestCasePushDialogProps {
  isOpen: boolean;
  onClose: () => void;
  testCases: any[]; // The structured test cases
}

export const JiraTestCasePushDialog: React.FC<JiraTestCasePushDialogProps> = ({
  isOpen,
  onClose,
  testCases
}) => {
  const { token } = useAuth();
  
  const [formData, setFormData] = useState({
    jira_url: '',
    email: '',
    api_token: '',
    project_key: '',
    issue_type: 'Task',
    ticket_summary: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ ticket_key: string, ticket_url: string } | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payloadTestCases = testCases.length > 0 ? testCases : [{
        id: "TC-001",
        title: "Sample Test Case",
        type: "Functional",
        priority: "High",
        module: "Authentication",
        acceptance_criteria: {
          given: ["User is on the login page"],
          when: ["User enters valid credentials"],
          then: ["User is redirected to the dashboard"]
        }
      }];

      const res = await fetch(apiUrl('/jira/push-test-cases'), {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          test_cases: payloadTestCases
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to push test cases');
      }

      setSuccessData({
        ticket_key: data.jira_key,
        ticket_url: data.jira_ticket_url
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="text-xl font-bold">Push Test Cases to Jira</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {successData ? (
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                <Link2 size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-emerald-500">Success!</h3>
              <p className="text-muted-foreground mb-6">Your test cases have been pushed to Jira.</p>
              <a 
                href={successData.ticket_url} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent/90 transition-colors"
              >
                View Ticket {successData.ticket_key}
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">Jira URL</label>
                <input 
                  required
                  type="url"
                  name="jira_url"
                  placeholder="https://your-domain.atlassian.net"
                  className="w-full p-2.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-accent outline-none transition-all"
                  value={formData.jira_url}
                  onChange={handleChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email</label>
                  <input 
                    required
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    className="w-full p-2.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-accent outline-none transition-all"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">API Token</label>
                  <input 
                    required
                    type="password"
                    name="api_token"
                    placeholder="Paste token here"
                    className="w-full p-2.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-accent outline-none transition-all"
                    value={formData.api_token}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Project Key</label>
                  <input 
                    required
                    type="text"
                    name="project_key"
                    placeholder="e.g. ENG"
                    className="w-full p-2.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-accent outline-none transition-all uppercase"
                    value={formData.project_key}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Issue Type</label>
                  <select 
                    required
                    name="issue_type"
                    className="w-full p-2.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-accent outline-none transition-all"
                    value={formData.issue_type}
                    onChange={handleChange}
                  >
                    <option value="Task">Task</option>
                    <option value="Story">Story</option>
                    <option value="Bug">Bug</option>
                    <option value="Epic">Epic</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Ticket Summary (Optional)</label>
                <input 
                  type="text"
                  name="ticket_summary"
                  placeholder="Auto-generated if left blank"
                  className="w-full p-2.5 rounded-xl border border-input bg-background focus:ring-2 focus:ring-accent outline-none transition-all"
                  value={formData.ticket_summary}
                  onChange={handleChange}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border/50">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-input font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || testCases.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Pushing...</> : 'Push to Jira'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
