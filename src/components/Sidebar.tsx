// src/components/Sidebar.tsx
import React from 'react';
import SuggestionCard from './SuggestionCard';
import type { SSEEventData, ValidatedSuggestionPackage } from '../services/api'; // Import types
 // Import types
import { Bot, CircleDashed, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface SidebarProps {
  progressLog: SSEEventData[];
  suggestions: ValidatedSuggestionPackage[];
  onAcceptSuggestion: (suggestionPackage: ValidatedSuggestionPackage) => void;
  onRejectSuggestion: (suggestionPackage: ValidatedSuggestionPackage) => void;
  isLoading: boolean;
  className?: string;
}

const getIconForStep = (event: SSEEventData) => {
    const step = event.step_code || event.event_type;
    const size = 18;
    if (event.event_type === "error" || event.event_type === "fatal_error" || (event.message && event.message.toLowerCase().includes("error"))) {
        return <XCircle className="text-red-500 mr-2 inline-block" size={size} />;
    }
    if (event.event_type === "warning") {
        return <AlertTriangle className="text-yellow-500 mr-2 inline-block" size={size} />;
    }
    if (step?.includes("START") || step?.includes("INITIATED")) {
        return <CircleDashed className="animate-spin text-sky-500 mr-2 inline-block" size={size} />;
    }
    if (step?.includes("DONE") || step?.includes("END") || step?.includes("RECEIVED") || step?.includes("COMPLETE") || event.event_type === "validated_suggestion_package" || event.event_type === "final_summary") {
        return <CheckCircle2 className="text-green-500 mr-2 inline-block" size={size} />;
    }
    return <Bot className="text-slate-500 mr-2 inline-block" size={size} />;
}

const Sidebar: React.FC<SidebarProps> = ({
  progressLog,
  suggestions,
  onAcceptSuggestion,
  onRejectSuggestion,
  isLoading,
  className = ''
}) => {
  return (
    <aside className={`sidebar w-[400px] min-w-[350px] p-5 border-l border-slate-300 h-full overflow-y-auto bg-white shadow-lg ${className}`}>
      <h3 className="text-xl font-semibold text-slate-700 mb-4 flex items-center">
        <Bot size={24} className="mr-2 text-sky-600" /> ASAVE AI Assistant
      </h3>
      
      <div className="progress-log mb-6 max-h-[40vh] overflow-y-auto border border-slate-200 rounded-md p-3 bg-slate-50 text-sm shadow-inner">
        <h4 className="text-md font-medium text-slate-600 mb-2">⚙️ Processing Log:</h4>
        {isLoading && progressLog.length === 0 && <p className="text-slate-500 italic">Initializing analysis...</p>}
        {progressLog.map((log, index) => (
          <div key={index} className="mb-1 pb-1 border-b border-slate-100 last:border-b-0 text-xs leading-relaxed">
            <span className="align-middle">{getIconForStep(log)}</span>
            <span className="font-medium text-slate-700">{log.agent_name || log.step_code || log.event_type}: </span>
            <span className="text-slate-600">{log.message}</span>
            {log.payload && typeof log.payload === 'object' && Object.keys(log.payload).length > 0 && (
                 <details className="mt-1">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-sky-600">Toggle Details</summary>
                    <pre className="text-xs whitespace-pre-wrap break-all bg-slate-100 p-1.5 rounded mt-1 max-h-28 overflow-y-auto">{JSON.stringify(log.payload, null, 2)}</pre>
                 </details>
            )}
          </div>
        ))}
        {isLoading && <p className="text-sky-600 italic mt-2">Thinking... 🤔</p>}
        {!isLoading && progressLog.length > 0 && progressLog[progressLog.length -1]?.event_type !== 'final_summary' && <p className="text-slate-500 italic mt-2">Waiting for next step or completion...</p>}
      </div>

      <hr className="my-4 border-slate-300" />
      <h4 className="text-md font-medium text-slate-600 mb-3">💡 Suggestions:</h4>
      {suggestions && suggestions.length > 0 ? (
        <div className="space-y-4">
          {suggestions.map((suggPackage, index) => (
            <SuggestionCard
              key={`${suggPackage.source_agent_name}-${index}`} // More unique key
              suggestionPackage={suggPackage}
              onAccept={() => onAcceptSuggestion(suggPackage)}
              onReject={() => onRejectSuggestion(suggPackage)}
            />
          ))}
        </div>
      ) : (
        <p className="text-slate-500 italic">
          {isLoading ? "Waiting for suggestions..." : "No suggestions yet. Select text from a PDF and click 'Get AI Assistance'."}
        </p>
      )}
    </aside>
  );
};

export default Sidebar;