// src/components/SuggestionCard.tsx
import React, { useState } from 'react';
import { diffWordsWithSpace } from 'diff'; // Using 'diff' library
import type { ValidatedSuggestionPackage } from '../services/api';
import { ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SuggestionCardProps {
  suggestionPackage: ValidatedSuggestionPackage;
  onAccept: () => void;
  onReject: () => void;
}

const generateTextDiffHtml = (originalText: string = '', proposedText: string = ''): string => {
  if (!originalText && !proposedText) return "<span class='text-slate-500 italic'>No text provided for diff.</span>";
  const diffResult = diffWordsWithSpace(originalText || '', proposedText || '');
  let html = '';
  diffResult.forEach((part) => {
    const style = part.added
      ? 'bg-green-100 text-green-700'
      : part.removed
      ? 'bg-red-100 text-red-700 line-through'
      : 'text-slate-600';
    const partValueHtml = part.value.replace(/\n/g, "<br />");
    html += `<span class="${style}">${partValueHtml}</span>`;
  });
  return html;
};

const SuggestionCard: React.FC<SuggestionCardProps> = ({ suggestionPackage, onAccept, onReject }) => {
  const [showDetails, setShowDetails] = useState(false);
  const suggDetails = suggestionPackage.suggestion_details || {};
  const scvaReport = suggestionPackage.scva_report || {};
  const isccaReport = suggestionPackage.iscca_report || {};

  const originalText = suggDetails.original_text || "N/A (Original text not provided in suggestion)";
  const proposedText = suggDetails.proposed_text || "";  return (
    <div className="suggestion-card-container bg-white border border-slate-200 rounded-lg p-4 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 group">
      <div className="flex justify-between items-start mb-2">
        <div>
            <p className="text-xs text-[#0369a1] font-semibold bg-[#e0f2fe] px-2.5 py-0.5 rounded-full inline-block">
                Source: {suggestionPackage.source_agent_name || 'Unknown Agent'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Type: {suggDetails.change_type || 'N/A'}</p>
        </div>
        <button 
            onClick={() => setShowDetails(!showDetails)} 
            className="text-slate-500 hover:text-[#0284c7] p-1 rounded-full hover:bg-[#f0f9ff] transition-colors"
            title={showDetails ? "Hide Details" : "Show Details"}
        >
            {showDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
        <h5 className="text-sm font-medium text-slate-700 mb-1">Proposed Change (Diff):</h5>
      <div 
        dangerouslySetInnerHTML={{ __html: generateTextDiffHtml(originalText, proposedText) }}
        className="diff-view border border-slate-300 p-2.5 rounded bg-slate-50 max-h-48 overflow-y-auto text-sm leading-relaxed scrollbar-thin"
      />
      
      <h5 className="text-sm font-medium text-slate-700 mt-3 mb-1">Markdown Preview:</h5>
      <div className="border border-slate-300 p-2.5 rounded bg-slate-50 max-h-48 overflow-y-auto text-sm prose prose-sm max-w-none scrollbar-thin">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {proposedText}
        </ReactMarkdown>
      </div>      <div className="mt-3 flex space-x-2">
        <button 
            onClick={onAccept} 
            className="flex items-center text-xs px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-md shadow-sm transition-colors duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
        >
            <ThumbsUp size={14} className="mr-1" /> Accept
        </button>
        <button 
            onClick={onReject} 
            className="flex items-center text-xs px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-md shadow-sm transition-colors duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
        >
            <ThumbsDown size={14} className="mr-1" /> Reject
        </button>
      </div>

      {showDetails && (
        <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-600 space-y-2">
          <div>
            <strong className="text-slate-700">Reasoning:</strong> {suggDetails.reasoning || 'N/A'}
          </div>
          <div>
            <strong className="text-slate-700">Shari'ah Notes (AISGA):</strong> {suggDetails.shariah_notes || 'N/A'}
          </div>
          <hr className="my-2"/>
          <h6 className="text-sm font-medium text-slate-700">Validation Summary: {suggestionPackage.validation_summary_score || 'N/A'}</h6>
          <details className="mt-1">
            <summary className="cursor-pointer hover:text-sky-600 font-medium">SCVA Report (Overall: {scvaReport.overall_status || 'N/A'})</summary>
            <pre className="whitespace-pre-wrap break-all bg-slate-100 p-2 mt-1 rounded max-h-40 overflow-y-auto">{JSON.stringify(scvaReport, null, 2)}</pre>
          </details>
          <details className="mt-1">
            <summary className="cursor-pointer hover:text-sky-600 font-medium">ISCCA Report (Status: {isccaReport.status || 'N/A'})</summary>
            <pre className="whitespace-pre-wrap break-all bg-slate-100 p-2 mt-1 rounded max-h-40 overflow-y-auto">{JSON.stringify(isccaReport, null, 2)}</pre>
          </details>
          <details className="mt-1">
            <summary className="cursor-pointer hover:text-sky-600 font-medium">AISGA Prompt Details</summary>
            <pre className="whitespace-pre-wrap break-all bg-slate-100 p-2 mt-1 rounded max-h-40 overflow-y-auto">{JSON.stringify(suggDetails.prompt_details_actual || {}, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default SuggestionCard;