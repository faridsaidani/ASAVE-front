// src/components/LeftSidebar.tsx
import React from 'react';
import { Database, PlusCircle, FolderOpenDot } from 'lucide-react';
import type { SessionInfo } from '../types';

interface LeftSidebarProps {
  isOpen: boolean;
  sessions: SessionInfo[];
  currentSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onCreateNewSession: () => void;
  onRefreshSessions: () => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ 
    isOpen, sessions, currentSessionId, onLoadSession, onCreateNewSession, onRefreshSessions 
}) => {
  if (!isOpen) return null;
  return (
    <aside className="w-60 bg-slate-50 border-r border-slate-300 p-3 flex flex-col shrink-0 text-sm space-y-3 scrollbar-thin overflow-y-auto">
        <div className="flex justify-between items-center">
            <h2 className="font-semibold text-slate-700 flex items-center">
                <Database size={16} className="mr-1.5 text-sky-600"/>Sessions
            </h2>
            <button 
                onClick={onRefreshSessions} 
                className="text-xs p-1 hover:bg-slate-200 rounded-md text-slate-500"
                title="Refresh Session List"
            >
                Refresh
            </button>
        </div>
        <button 
            onClick={onCreateNewSession} 
            className="w-full btn-secondary-small flex items-center justify-center py-1.5 text-xs"
        >
            <PlusCircle size={14} className="mr-1.5"/> Create / Initialize New
        </button>
        {sessions.length > 0 ? (
            <ul className="space-y-1.5 text-xs">
                {sessions.map(s => (
                    <li key={s.session_id}>
                        <button 
                            onClick={() => onLoadSession(s.session_id)} 
                            className={`w-full text-left p-1.5 rounded hover:bg-sky-100 transition-colors ${
                                s.session_id === currentSessionId 
                                ? 'bg-sky-100 border border-sky-500 font-medium text-sky-700' 
                                : 'border border-transparent hover:border-sky-200'
                            }`} 
                            title={`FAS DB: ${s.has_fas_db?'Yes':'No'}, SS DB: ${s.has_ss_db?'Yes':'No'}\nLast Modified: ${s.last_modified}`}
                        >
                            <FolderOpenDot size={12} className="inline mr-1 opacity-70"/> {s.session_id}
                        </button>
                    </li>
                ))}
            </ul>
        ) : <p className="text-xs text-slate-500 italic mt-2">No saved sessions found. Initialize one to get started.</p>}
    </aside>
  );
};

export default LeftSidebar;