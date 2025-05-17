// src/components/SuggestionCard.tsx
import React, { useState } from 'react';
import { diffWordsWithSpace } from 'diff';
import type { ValidatedSuggestionPackage } from '../services/api'; // Ensure this path is correct
import { ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Zap, Percent, Info as InfoIcon, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SuggestionCardProps {
  suggestionPackage: ValidatedSuggestionPackage;
  onAccept: () => void;
  onReject: () => void;
  isHighlighted?: boolean; // New prop for highlighting
}

const generateTextDiffHtml = (originalText: string = '', proposedText: string = ''): string => {
  if (!originalText && !proposedText) return "<span class='text-slate-400 italic text-xs'>No text provided for diff.</span>";
  const diffResult = diffWordsWithSpace(originalText || '', proposedText || '');
  let html = '';
  diffResult.forEach((part) => {
    const style = part.added
      ? 'bg-green-100 text-green-800 font-medium px-0.5 rounded-sm' // Enhanced added style
      : part.removed
      ? 'bg-red-100 text-red-800 line-through px-0.5 rounded-sm' // Enhanced removed style
      : 'text-slate-700'; // Normal text
    // Preserve newlines from Markdown by converting to <br /> for dangerouslySetInnerHTML
    const partValueHtml = part.value.replace(/\n/g, "<br />");
    html += `<span class="${style}">${partValueHtml}</span>`;
  });
  return html;
};

// Helper to add emojis to reasoning if not already present (simple example)
// A more robust solution would be LLM adding them or more advanced NLP.
const formatReasoningWithEmoji = (reasoning: string = ""): string => {
    if (!reasoning) return "N/A";
    // Simple keyword check - can be expanded
    if (reasoning.toLowerCase().includes("compliance") && !reasoning.includes("✅")) return `✅ ${reasoning}`;
    if (reasoning.toLowerCase().includes("clarity") && !reasoning.includes("💡")) return `💡 ${reasoning}`;
    if (reasoning.toLowerCase().includes("risk") && !reasoning.includes("⚠️")) return `⚠️ ${reasoning}`;
    if (reasoning.toLowerCase().includes("ambiguity") && !reasoning.includes("❓")) return `❓ ${reasoning}`;
    return reasoning;
};


const SuggestionCard: React.FC<SuggestionCardProps> = ({ 
    suggestionPackage, 
    onAccept, 
    onReject,
    isHighlighted = false 
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const suggDetails = suggestionPackage.suggestion_details || {};
  const scvaReport = suggestionPackage.scva_report || {};
  const isccaReport = suggestionPackage.iscca_report || {};

  const originalText = suggDetails.original_text || "N/A (Original text not provided)";
  const proposedText = suggDetails.proposed_text || "";
  const confidenceScore = suggDetails.confidence_score; // Can be undefined

  const cardBaseClass = "suggestion-card-container bg-white border rounded-lg p-3 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-px group";
  const highlightedClass = isHighlighted ? "border-purple-500 border-2 ring-2 ring-purple-300 shadow-purple-200/50" : "border-slate-200";

  return (
    <div className={`${cardBaseClass} ${highlightedClass}`}>
      <div className="flex justify-between items-start mb-1.5">
        <div>
            <p className="text-[11px] text-sky-700 font-semibold bg-sky-100 px-2 py-0.5 rounded-full inline-block">
                Source: {suggestionPackage.source_agent_name || 'Unknown Agent'}
            </p>
            {suggDetails.change_type && <p className="text-[10px] text-slate-500 mt-0.5 ml-0.5">Type: {suggDetails.change_type}</p>}
        </div>
        <div className="flex items-center">
            {confidenceScore !== undefined && (
                <div className={`flex items-center text-xs font-medium mr-2 px-1.5 py-0.5 rounded-full border ${
                    confidenceScore >= 80 ? 'bg-green-50 text-green-700 border-green-300' :
                    confidenceScore >= 60 ? 'bg-yellow-50 text-yellow-700 border-yellow-300' :
                    'bg-red-50 text-red-700 border-red-300'
                }`} title={`AI Confidence: ${confidenceScore}%`}>
                    <Zap size={12} className="mr-0.5"/> {confidenceScore}%
                </div>
            )}
            <button 
                onClick={() => setShowDetails(!showDetails)} 
                className="text-slate-400 hover:text-sky-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors"
                title={showDetails ? "Hide Details" : "Show Details"}
            >
                {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
        </div>
      </div>
      
      {isHighlighted && (
        <div className="mb-1.5 text-xs text-purple-700 font-medium flex items-center bg-purple-50 p-1 rounded-md border border-purple-200">
            <Percent size={12} className="mr-1"/> Highlighted: High Confidence & Meets Threshold
        </div>
      )}

      <h5 className="text-xs font-medium text-slate-600 mb-0.5 mt-1">Proposed Change (Diff):</h5>
      <div 
        dangerouslySetInnerHTML={{ __html: generateTextDiffHtml(originalText, proposedText) }}
        className="diff-view border border-slate-200 p-1.5 rounded bg-slate-50/70 max-h-32 overflow-y-auto text-xs leading-relaxed scrollbar-thin scrollbar-thumb-slate-300"
      />
      
      <details className="mt-1.5 group/markdown">
        <summary className="text-xs font-medium text-slate-600 cursor-pointer hover:text-sky-700 list-none flex items-center">
            <ChevronDown size={14} className="mr-0.5 text-slate-400 group-open/markdown:rotate-180 transition-transform"/>
            Markdown Preview
        </summary>
        <div className="border border-slate-200 p-1.5 mt-0.5 rounded bg-slate-50/70 max-h-32 overflow-y-auto text-xs prose prose-xs max-w-none scrollbar-thin scrollbar-thumb-slate-300">
            {proposedText ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{proposedText}</ReactMarkdown> : <p className="italic text-slate-500">No proposed text to preview.</p>}
        </div>
      </details>
      
      <div className="mt-2 flex space-x-1.5">
        <button 
            onClick={onAccept} 
            className="flex items-center text-[11px] px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-sm transition-colors duration-150 transform hover:-translate-y-px active:translate-y-0"
        >
            <ThumbsUp size={12} className="mr-1" /> Accept
        </button>
        <button 
            onClick={onReject} 
            className="flex items-center text-[11px] px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm transition-colors duration-150 transform hover:-translate-y-px active:translate-y-0"
        >
            <ThumbsDown size={12} className="mr-1" /> Reject
        </button>
      </div>

      {showDetails && (
        <div className="mt-2.5 pt-2 border-t border-slate-200 text-[11px] text-slate-600 space-y-1.5">
          <div className="flex items-start">
            <MessageCircle size={12} className="mr-1 mt-0.5 text-slate-500 shrink-0"/> 
            <div><strong className="text-slate-700">Reasoning:</strong> {formatReasoningWithEmoji(suggDetails.reasoning)}</div>
          </div>
          <div className="flex items-start">
            <InfoIcon size={12} className="mr-1 mt-0.5 text-slate-500 shrink-0"/>
            <div><strong className="text-slate-700">Shari'ah Notes (AISGA):</strong> {suggDetails.shariah_notes || 'N/A'}</div>
          </div>
          
          <hr className="my-1"/>
          <h6 className="text-[10px] font-medium text-slate-700">Validation Summary: {suggestionPackage.validation_summary_score || 'N/A'}</h6>
          <details className="text-[10px]">
            <summary className="cursor-pointer hover:text-sky-600 font-medium">SCVA Report (Overall: {scvaReport?.overall_status || 'N/A'})</summary>
            <pre className="whitespace-pre-wrap break-all bg-slate-100 p-1 mt-0.5 rounded max-h-28 overflow-y-auto scrollbar-thin">{JSON.stringify(scvaReport, null, 2)}</pre>
          </details>
          <details className="text-[10px]">
            <summary className="cursor-pointer hover:text-sky-600 font-medium">ISCCA Report (Status: {isccaReport?.status || 'N/A'})</summary>
            <pre className="whitespace-pre-wrap break-all bg-slate-100 p-1 mt-0.5 rounded max-h-28 overflow-y-auto scrollbar-thin">{JSON.stringify(isccaReport, null, 2)}</pre>
          </details>
          {suggDetails.prompt_details_actual && (
            <details className="text-[10px]">
                <summary className="cursor-pointer hover:text-sky-600 font-medium">AISGA Prompt Details</summary>
                <pre className="whitespace-pre-wrap break-all bg-slate-100 p-1 mt-0.5 rounded max-h-28 overflow-y-auto scrollbar-thin">{JSON.stringify(suggDetails.prompt_details_actual, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default SuggestionCard;