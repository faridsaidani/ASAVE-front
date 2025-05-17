// src/components/Sidebar.tsx
import React, { useEffect, useState, useMemo } from 'react';
import SuggestionCard from './SuggestionCard';
import type { SSEEventData, ValidatedSuggestionPackage } from '../types';
import { Bot, CircleDashed, CheckCircle2, AlertTriangle, XCircle, Clock, Shield, ArrowRight } from 'lucide-react';

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

// Group logs by stage for better organization
interface LogGroup {
  stageName: string;
  logs: SSEEventData[];
  isComplete: boolean;
  hasErrors: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  progressLog,
  suggestions,
  onAcceptSuggestion,
  onRejectSuggestion,
  isLoading,
  className = ''
}) => {
  const [showNotification, setShowNotification] = useState(false);
  const [notifiedSuggestionsCount, setNotifiedSuggestionsCount] = useState(0);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(["current"]));
  
  // Group logs into stages for better readability
  const logGroups = useMemo(() => {
    const groups: LogGroup[] = [];
    let currentStage: LogGroup | null = null;
    
    // Helper to finalize a stage and add it to groups
    const finalizeStage = () => {
      if (currentStage && currentStage.logs.length > 0) {
        groups.push({...currentStage});
      }
    };
    
    progressLog.forEach(log => {
      const step = log.step_code || "";
      const isStart = step.includes("START") || step.includes("INITIATED");
      const isEnd = step.includes("DONE") || step.includes("END") || step.includes("COMPLETE");
      const hasError = log.event_type === "error" || log.event_type === "fatal_error" || (log.message && log.message.toLowerCase().includes("error"));
      
      // Detect new stage beginning
      if (isStart || (!currentStage && !isEnd)) {
        finalizeStage();
        currentStage = {
          stageName: log.agent_name || log.step_code || "Processing",
          logs: [log],
          isComplete: false,
          hasErrors: hasError
        };
      } 
      // Add to current stage
      else if (currentStage) {
        currentStage.logs.push(log);
        if (hasError) currentStage.hasErrors = true;
        if (isEnd) currentStage.isComplete = true;
      }
      // Orphaned end log with no start
      else {
        groups.push({
          stageName: log.agent_name || log.step_code || "Processing",
          logs: [log],
          isComplete: isEnd,
          hasErrors: hasError
        });
      }
      
      // If we finished a stage, add it and reset
      if (currentStage && isEnd) {
        finalizeStage();
        currentStage = null;
      }
    });
    
    // Add the last stage if it wasn't closed
    finalizeStage();
    
    return groups;
  }, [progressLog]);
  
  // Auto-expand the current (last non-complete) stage
  useEffect(() => {
    if (logGroups.length > 0) {
      // Find last non-complete group or the last group
      const currentGroupIndex = logGroups.findIndex(g => !g.isComplete);
      const currentGroupName = currentGroupIndex >= 0 ? 
        logGroups[currentGroupIndex].stageName : 
        logGroups[logGroups.length - 1].stageName;
      
      setExpandedStages(prev => {
        const newSet = new Set(prev);
        newSet.add(currentGroupName);
        return newSet;
      });
    }
  }, [logGroups]);
  
  // Show notification for new suggestions
  useEffect(() => {
    if (suggestions.length > notifiedSuggestionsCount && !isLoading) {
      setShowNotification(true);
      setNotifiedSuggestionsCount(suggestions.length);
      
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 8000);
      
      return () => clearTimeout(timer);
    }
  }, [suggestions, isLoading, notifiedSuggestionsCount]);

  // Toggle expanded state for a log group
  const toggleStageExpand = (stageName: string) => {
    setExpandedStages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stageName)) {
        newSet.delete(stageName);
      } else {
        newSet.add(stageName);
      }
      return newSet;
    });
  };

  return (
    <aside className={`sidebar w-[400px] min-w-[350px] p-5 border-l border-slate-300 h-full overflow-y-auto bg-white shadow-lg scrollbar-thin animate-slide-in-right ${className} relative`}>
      {/* Suggestion Ready Notification */}
      {showNotification && (
        <div className="absolute top-16 right-5 left-5 bg-gradient-to-r from-[#ebf8ff] to-[#e0f2fe] border-l-4 border-[#0ea5e9] rounded-md shadow-md p-4 z-10 animate-slide-in-right">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <Shield className="h-5 w-5 text-[#0284c7]" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-[#075985]">Suggestion Ready</h3>
              <div className="mt-1 text-xs text-[#0369a1]">
                <p>A new suggestion is available and will be reviewed for accuracy.</p>
                <div className="mt-2 flex items-center">
                  <Clock className="h-4 w-4 text-[#0284c7] mr-1" />
                  <p className="font-medium">Under review</p>
                </div>
              </div>
            </div>
            <button 
              className="ml-auto -mt-1 -mr-1 bg-white rounded-full p-1 hover:bg-[#f0f9ff]"
              onClick={() => setShowNotification(false)}
            >
              <span className="sr-only">Dismiss</span>
              <XCircle className="h-4 w-4 text-[#0284c7]" />
            </button>
          </div>
        </div>
      )}

      <h3 className="text-xl font-semibold text-[#0369a1] mb-4 flex items-center border-b pb-3 border-slate-200">
        <Bot size={24} className="mr-2 text-[#0284c7]" /> ASAVE AI Assistant
      </h3>
      
      <div className="progress-log mb-6 max-h-[40vh] overflow-y-auto border border-slate-200 rounded-md p-3 bg-slate-50 text-sm shadow-inner scrollbar-thin">
        <h4 className="text-md font-medium text-slate-600 mb-3 flex items-center">
          <span className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full bg-[#e0f2fe] text-[#075985] text-xs">⚙️</span>
          Request Status
          {isLoading && <span className="ml-2 text-xs text-[#0284c7] animate-pulse flex items-center">
            <CircleDashed size={12} className="animate-spin mr-1" /> Processing
          </span>}
        </h4>
        
        {isLoading && progressLog.length === 0 && 
          <div className="flex items-center justify-center h-20 text-slate-500">
            <CircleDashed size={16} className="animate-spin mr-2" />
            <p>Initializing analysis...</p>
          </div>
        }
        
        {/* Grouped logs with collapsible sections */}
        {logGroups.length > 0 ? (
          <div className="space-y-2">
            {logGroups.map((group, groupIndex) => {
              const isExpanded = expandedStages.has(group.stageName);
              const isLastActive = !group.isComplete && groupIndex === logGroups.findIndex(g => !g.isComplete);
              
              // Status indicator
              let statusBg = "bg-slate-100";
              let statusText = "text-slate-600";
              if (group.hasErrors) {
                statusBg = "bg-red-50";
                statusText = "text-red-600";
              } else if (group.isComplete) {
                statusBg = "bg-green-50";
                statusText = "text-green-600";
              } else if (isLoading) {
                statusBg = "bg-blue-50";
                statusText = "text-blue-600";
              }
              
              return (
                <div 
                  key={`group-${groupIndex}`} 
                  className={`border rounded-md overflow-hidden transition-all duration-200 ${
                    group.hasErrors ? 'border-red-200' : 
                    isLastActive ? 'border-blue-200 shadow-sm' : 
                    group.isComplete ? 'border-green-200' : 'border-slate-200'
                  }`}
                >
                  <button 
                    onClick={() => toggleStageExpand(group.stageName)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm ${statusBg} ${statusText} font-medium transition-colors hover:bg-opacity-80`}
                  >
                    <div className="flex items-center">
                      {group.hasErrors ? (
                        <XCircle size={16} className="mr-2 text-red-500" />
                      ) : group.isComplete ? (
                        <CheckCircle2 size={16} className="mr-2 text-green-500" />
                      ) : (
                        <CircleDashed size={16} className={`mr-2 ${isLoading ? "animate-spin text-blue-500" : "text-slate-500"}`} />
                      )}
                      <span>
                        {group.stageName}
                        {isLastActive && isLoading && <span className="ml-2 animate-pulse"> (In progress...)</span>}
                      </span>
                    </div>
                    <ArrowRight 
                      size={16} 
                      className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                    />
                  </button>
                  
                  {isExpanded && (
                    <div className="px-3 py-2 bg-white text-xs border-t border-slate-100">
                      {group.logs.map((log, logIndex) => (
                        <div 
                          key={`log-${groupIndex}-${logIndex}`} 
                          className={`py-1.5 ${logIndex < group.logs.length - 1 ? 'border-b border-slate-100' : ''}`}
                        >
                          <div className="flex">
                            <span className="w-5 flex-shrink-0">{getIconForStep(log)}</span>
                            <div className="flex-grow">
                              <span className="font-medium text-slate-700">
                                {log.agent_name || log.step_code || log.event_type}: 
                              </span>
                              <span className="ml-1 text-slate-600">{log.message}</span>
                              
                              {log.payload && typeof log.payload === 'object' && Object.keys(log.payload).length > 0 && (
                                <details className="mt-1 ml-1">
                                  <summary className="text-xs text-slate-500 cursor-pointer hover:text-[#0284c7]">Details</summary>
                                  <pre className="text-xs whitespace-pre-wrap break-all bg-slate-100 p-1.5 rounded mt-1 max-h-28 overflow-y-auto scrollbar-thin">{JSON.stringify(log.payload, null, 2)}</pre>
                                </details>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-slate-500 italic">No processing data yet.</p>
        )}
      </div>

      <hr className="my-4 border-slate-300" />
      <h4 className="text-md font-medium text-slate-600 mb-3 flex items-center">
        <span className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded-full bg-[#e0f2fe] text-[#075985] text-xs">💡</span>
        Suggestions {suggestions.length > 0 && <span className="ml-2 px-2 py-0.5 bg-[#0ea5e9] text-white text-xs rounded-full">{suggestions.length}</span>}
      </h4>
      
      {suggestions && suggestions.length > 0 ? (
        <div className="space-y-4">
          {suggestions.map((suggPackage, index) => (
            <React.Fragment key={`${suggPackage.source_agent_name}-${index}`}>
              {index === 0 && (
                <div className="mb-3 px-3 py-2 bg-[#f0f9ff] border-l-4 border-[#0284c7] rounded-sm">
                  <p className="text-xs text-[#0369a1] flex items-center">
                    <Shield className="h-4 w-4 mr-1" />
                    <span className="font-medium">Suggestions under review</span>
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    All suggestions are reviewed for accuracy before being applied.
                  </p>
                </div>
              )}
              <SuggestionCard
                suggestionPackage={suggPackage}
                onAccept={() => onAcceptSuggestion(suggPackage)}
                onReject={() => onRejectSuggestion(suggPackage)}
              />
            </React.Fragment>
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