import React from 'react';
import { Bot, Sun, Moon, FileText, RefreshCcw } from 'lucide-react';

interface AppHeaderProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  isUploaded: boolean;
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  resetState: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  theme,
  toggleTheme,
  isUploaded,
  showPreview,
  setShowPreview,
  resetState
}) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border glass z-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={resetState}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bot size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight">DocuMind AI</h1>
            <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Intelligent Analysis</p>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button 
          onClick={toggleTheme}
          className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        {isUploaded && (
          <button 
            onClick={() => setShowPreview(!showPreview)}
            className={`p-2.5 rounded-xl transition-all ${showPreview ? 'bg-accent/10 text-accent' : 'text-muted-foreground hover:text-foreground'}`}
            title="Toggle Preview"
          >
            <FileText size={20} />
          </button>
        )}
        
        <button 
          onClick={resetState}
          className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all group"
          title="New Session"
        >
          <RefreshCcw size={20} className="group-hover:rotate-180 transition-transform duration-500" />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
