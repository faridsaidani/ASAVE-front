/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/SuggestionCard.tsx
import React, { useState } from 'react';
import { diffWordsWithSpace } from 'diff';
import type { ValidatedSuggestionPackage } from '../types';
import { ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Zap, Percent, Info as InfoIcon, MessageCircle, FileText, CheckCircle, Layers, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SuggestionCardProps {
  suggestionPackage: ValidatedSuggestionPackage;
  onAccept: () => void;
  onReject: () => void;
  isHighlighted?: boolean;
}

const generateTextDiffHtml = (originalText: string = '', proposedText: string = ''): string => {
  if (!originalText && !proposedText) return "<span class='text-slate-400 italic text-xs'>No text provided for diff.</span>";
  const diffResult = diffWordsWithSpace(originalText || '', proposedText || '');
  let html = '';
  diffResult.forEach((part) => {
    const style = part.added
      ? 'bg-green-100 text-green-800 font-medium px-0.5 rounded-sm'
      : part.removed
      ? 'bg-red-100 text-red-800 line-through px-0.5 rounded-sm'
      : 'text-slate-700';
    const partValueHtml = part.value.replace(/\n/g, "<br />"); // Convert newlines for HTML
    html += `<span class="${style}">${partValueHtml}</span>`;
  });
  return html;
};

const formatReasoningWithEmoji = (reasoning: string = ""): string => {
    if (!reasoning) return "N/A";
    if (reasoning.toLowerCase().includes("compliance") && !reasoning.includes("✅")) return `✅ ${reasoning}`;
    if (reasoning.toLowerCase().includes("clarity") && !reasoning.includes("💡")) return `💡 ${reasoning}`;
    if (reasoning.toLowerCase().includes("risk") && !reasoning.includes("⚠️")) return `⚠️ ${reasoning}`;
    if (reasoning.toLowerCase().includes("ambiguity") && !reasoning.includes("❓")) return `❓ ${reasoning}`;
    return reasoning;
};

const DetailSection: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
    <div className="mt-2">
        <h6 className="text-xs font-semibold text-slate-600 mb-0.5 flex items-center">
            {icon || <InfoIcon size={12} className="mr-1 text-slate-500"/>}
            {title}
        </h6>
        <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 max-h-48 overflow-y-auto scrollbar-thin">
            {children}
        </div>
    </div>
);

const ScvaIssueDisplay: React.FC<{ issue: any }> = ({ issue }) => (
    <div className="p-1.5 border-b border-slate-200 last:border-b-0">
        <p><strong className="text-slate-600">Rule ID:</strong> {issue.rule_id || "N/A"}</p>
        <p><strong className="text-slate-600">Concern:</strong> {issue.concern || "N/A"}</p>
        <p><strong className="text-slate-600">Severity:</strong> <span className={`font-medium px-1 rounded text-white ${
            issue.severity?.toLowerCase().includes('clear violation') ? 'bg-red-500' : 
            issue.severity?.toLowerCase().includes('potential') ? 'bg-yellow-500' :
            issue.severity?.toLowerCase().includes('minor') ? 'bg-blue-400' : 'bg-slate-400'
        }`}>{issue.severity || "N/A"}</span></p>
    </div>
);


const SuggestionCard: React.FC<SuggestionCardProps> = ({ 
    suggestionPackage, 
    onAccept, 
    onReject,
    isHighlighted = false 
}) => {
  const [showDetails, setShowDetails] = useState(false); // Default to details hidden
  const suggDetails = suggestionPackage.suggestion_details || {};
  const scvaReport = suggestionPackage.scva_report || {};
  const isccaReport = suggestionPackage.iscca_report || {};

  const originalText = suggDetails.original_text || "N/A";
  const proposedText = suggDetails.proposed_text || "";
  const confidenceScore = suggDetails.confidence_score;

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
            <Percent size={12} className="mr-1"/> Highlighted: Meets Confidence Threshold
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
            Markdown Preview of Proposed Text
        </summary>
        <div className="border border-slate-200 p-1.5 mt-0.5 rounded bg-slate-50/70 max-h-32 overflow-y-auto text-xs prose prose-sm max-w-none scrollbar-thin scrollbar-thumb-slate-300">
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
        <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] text-slate-600 space-y-1.5">
          <DetailSection title="Agent's Reasoning" icon={<MessageCircle size={12} className="mr-1 text-slate-500"/>}>
            <p className="whitespace-pre-wrap">{formatReasoningWithEmoji(suggDetails.reasoning)}</p>
          </DetailSection>
          
          <DetailSection title="Agent's Shari'ah Notes" icon={<FileText size={12} className="mr-1 text-slate-500"/>}>
             <p className="whitespace-pre-wrap">{suggDetails.shariah_notes || 'N/A'}</p>
          </DetailSection>
          
          <hr className="my-2 border-slate-100"/>
          
          <div className="p-2 bg-sky-50 border border-sky-200 rounded-md">
            <h6 className="text-xs font-semibold text-sky-700 mb-1">
                Validation Summary: {suggestionPackage.validation_summary_score || 'N/A'}
            </h6>
            <DetailSection title="SCVA Report" icon={<CheckCircle size={12} className="mr-1 text-green-600"/>}>
                <p><strong>Overall Status:</strong> {scvaReport?.overall_status || 'N/A'}</p>
                <p><strong>Summary:</strong> {scvaReport?.summary_explanation || 'N/A'}</p>
                {scvaReport?.explicit_rule_batch_assessment?.identified_issues && scvaReport.explicit_rule_batch_assessment.identified_issues.length > 0 && (
                    <div className="mt-1">
                        <p className="font-medium text-slate-600">Identified Rule Issues:</p>
                        {scvaReport.explicit_rule_batch_assessment.identified_issues.map((issue: any, idx: number) => (
                            <ScvaIssueDisplay key={`scva-issue-${idx}`} issue={issue} />
                        ))}
                    </div>
                )}
                {scvaReport?.semantic_validation_against_ss?.status !== 'Not Performed' && (
                    <div className="mt-1 pt-1 border-t border-slate-200">
                        <p className="font-medium text-slate-600">Semantic SS Validation:</p>
                        <p><strong>Status:</strong> {scvaReport.semantic_validation_against_ss?.status || 'N/A'}</p>
                        <p><strong>Notes:</strong> {scvaReport.semantic_validation_against_ss?.notes || 'N/A'}</p>
                    </div>
                )}
                 <details className="text-[10px] mt-1">
                    <summary className="cursor-pointer hover:text-sky-700 font-medium">Full SCVA JSON</summary>
                    <pre className="whitespace-pre-wrap break-all bg-slate-100 p-1.5 mt-0.5 rounded max-h-32 overflow-y-auto scrollbar-thin">{JSON.stringify(scvaReport, null, 2)}</pre>
                </details>
            </DetailSection>

            <DetailSection title="ISCCA Report" icon={<Layers size={12} className="mr-1 text-blue-600"/>}>
                <p><strong>Status:</strong> {isccaReport?.status || 'N/A'}</p>
                <p><strong>Explanation:</strong> {isccaReport?.explanation || 'N/A'}</p>
                {isccaReport?.conflicting_terms_or_principles && isccaReport.conflicting_terms_or_principles.length > 0 && (
                     <p><strong>Conflicts:</strong> {isccaReport.conflicting_terms_or_principles.join(', ')}</p>
                )}
                <details className="text-[10px] mt-1">
                    <summary className="cursor-pointer hover:text-sky-700 font-medium">Full ISCCA JSON</summary>
                    <pre className="whitespace-pre-wrap break-all bg-slate-100 p-1.5 mt-0.5 rounded max-h-32 overflow-y-auto scrollbar-thin">{JSON.stringify(isccaReport, null, 2)}</pre>
                </details>
            </DetailSection>
          </div>
          
          {suggDetails.prompt_details_actual && (
            <DetailSection title="AISGA Prompt Details" icon={<Brain size={12} className="mr-1 text-purple-600"/>}>
                <pre className="whitespace-pre-wrap break-all">{JSON.stringify(suggDetails.prompt_details_actual, null, 2)}</pre>
            </DetailSection>
          )}
        </div>
      )}
    </div>
  );
};

export default SuggestionCard;