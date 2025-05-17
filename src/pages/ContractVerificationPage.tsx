/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/ContractVerificationPage.tsx
import React, { useState, useCallback, useRef } from 'react';
import SuggestionCard from '../components/SuggestionCard'; // Reusable
import {
    type SSEEventData,
    type FullContractReviewReport,
    // Other contract-specific types from App_v2.tsx/types.ts
} from '../types';
import type { ClientClauseInput, ClauseValidationPayload, ClauseAiSuggestionPayload, ClauseAnalysisResult, ChatMessage } from '../types'; // Assuming types.ts
import { Loader2, ShieldCheck, ListChecks, FileSearch2, FileSignature, InfoIcon } from 'lucide-react';

// Sample contract - can be moved to a constants file
const sampleSalamContractForHelper = {
    contract_type: "Salam",
    client_clauses_text: `Al Baraka Bank Algeria – Ouargla Branch, registered under RC 06B093, hereinafter referred to as “the Bank” or Rab al-Salam.
Al Nour Cooperative for Flour Production, located in Ghardaïa, represented by Mr. Amine Boukhatem, acting as purchasing manager, hereinafter referred to as “the Buyer” or Muslam Ilaihi.
Article 1 – Subject of the Contract
The Bank undertakes to deliver 100 quintals of durum wheat to the Buyer on a future date, in accordance with the Salam contract terms.
Article 2 – Payment
The Buyer shall pay 2,800,000 DZD (28,000 DZD per quintal) in full and immediately upon signature of the contract.
Payment is to be transferred to the Bank's designated Salam operations account.
Article 3 – Description of Goods (al-Muslam Fihi)
Commodity: Durum wheat
Variety: Certified “Boussalem”
Moisture: ≤ 12%
Impurities: ≤ 2%
Packaging: 100 kg sacks
Fungible commodity, defined by standard industrial specifications
Article 4 – Delivery
Delivery Date: July 15, 2025
Delivery Location: Warehouse of Al Nour Cooperative in Ghardaïa
The goods must fully comply with the specifications. Customary tolerances apply.
Article 5 – Provisions
No penalty for late delivery is allowed.
In case of inability to deliver on time, the Buyer may: Grant an extension; Or request a refund of the capital.`,
    overall_contract_context: "Initial Salam Credit Contract No. BCI-2025/Sal-102 for the delivery of 100 quintals of durum wheat by Al Baraka Bank Algeria to Al Nour Cooperative for Flour Production."
};


interface ContractVerificationPageProps {
  isSystemInitialized: boolean;
  sendSystemNotification: (message: string, type?: 'info' | 'error' | 'success' | 'warning') => void;
  addMessageToChat?: (sender: ChatMessage['sender'], text?: string, component?: React.ReactNode, isLoadingPlaceholder?: boolean) => string;
  globalSseControllerRef: React.RefObject<AbortController | null>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const ContractVerificationPage: React.FC<ContractVerificationPageProps> = ({
  isSystemInitialized,
  sendSystemNotification,
}) => {
  const [contractHelperMode, setContractHelperMode] = useState<'full_contract' | 'clause_by_clause'>('clause_by_clause');
  const [contractType, setContractType] = useState<string>(sampleSalamContractForHelper.contract_type);
  const [clientClausesInput, setClientClausesInput] = useState<string>(sampleSalamContractForHelper.client_clauses_text);
  const [fullContractTextInput, setFullContractTextInput] = useState<string>(sampleSalamContractForHelper.client_clauses_text); // Init with sample
  const [overallContractCtx, setOverallContractCtx] = useState<string>(sampleSalamContractForHelper.overall_contract_context);
  
  const [clauseAnalysisResults, setClauseAnalysisResults] = useState<ClauseAnalysisResult[]>([]);
  const [fullContractReviewReport, setFullContractReviewReport] = useState<FullContractReviewReport | null>(null);
  
  const [isProcessingContract, setIsProcessingContract] = useState<boolean>(false);
  const [contractPageProgressLog, setContractPageProgressLog] = useState<SSEEventData[]>([]); // Local progress log for this page

  const pageSseControllerRef = useRef<AbortController | null>(null);

  const minConfidenceForHighlight = 75; // Or make this configurable

  const handleValidateContractTerms = useCallback(() => {
    if (!isSystemInitialized) {
      sendSystemNotification("Please initialize the backend system first for optimal contract validation.", "warning");
    }
    let clausesForApi: ClientClauseInput[] = [];
    let contractTextForApi = "";

    if (contractHelperMode === 'clause_by_clause') {
        if (!clientClausesInput.trim()) { sendSystemNotification("Please enter contract clauses.", "error"); return; }
        clausesForApi = clientClausesInput.split('\n')
            .map((text, index) => ({ clause_id: `user_clause_${index + 1}_${Date.now()}`, text: text.trim() }))
            .filter(clause => clause.text.length > 0);
        if (!clausesForApi.length) { sendSystemNotification("No valid clauses parsed.", "error"); return; }
    } else {
        if (!fullContractTextInput.trim()) { sendSystemNotification("Please enter the full contract text.", "error"); return; }
        contractTextForApi = fullContractTextInput;
    }

    setClauseAnalysisResults([]); 
    setFullContractReviewReport(null);
    setContractPageProgressLog([]); // Clear previous page-specific logs
    setIsProcessingContract(true);
    sendSystemNotification(`AI is reviewing your ${contractHelperMode === 'clause_by_clause' ? 'clauses' : 'full contract'}... 🧠`, "info");

    const endpoint = contractHelperMode === 'clause_by_clause' 
        ? `${API_BASE_URL}/validate_contract_terms_stream` 
        : `${API_BASE_URL}/review_full_contract_stream`;
    const payload = contractHelperMode === 'clause_by_clause' 
        ? { contract_type: contractType, client_clauses: clausesForApi, overall_contract_context: overallContractCtx } 
        : { full_contract_text: contractTextForApi, contract_type: contractType };

    // Using pageSseControllerRef for page-specific task
    if (pageSseControllerRef.current) pageSseControllerRef.current.abort();
    const controller = new AbortController();
    pageSseControllerRef.current = controller;

    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal })
      .then(async response => {
        if (!response.ok) { const et = await response.text(); throw new Error(`API Error: ${response.status} - ${et}`); }
        if (!response.body) throw new Error("No response body from API.");
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let sseBuffer = '';
        
        async function processStream() {
          while (true) {
            try {
              const { done, value } = await reader.read();
              if (controller.signal.aborted) { sendSystemNotification("Contract review cancelled by user.", "info"); break; }
              if (done) { sendSystemNotification("Contract review stream finished.", "success"); break; }
              sseBuffer += decoder.decode(value, { stream: true });
              const messages = sseBuffer.split('\n\n'); sseBuffer = messages.pop() || '';
              messages.forEach(message => {
                if (message.startsWith('data: ')) {
                  try {
                    const eventData = JSON.parse(message.substring(6)) as SSEEventData;
                    setContractPageProgressLog(prev => [...prev, eventData]); // Update local log

                    if (contractHelperMode === 'clause_by_clause') {
                        if (eventData.event_type === "clause_validation_result" && eventData.payload) {
                            const data = eventData.payload as ClauseValidationPayload;
                            setClauseAnalysisResults(prev => {
                                const existing = prev.find(r => r.clause_id === data.clause_id);
                                if (existing) return prev.map(r => r.clause_id === data.clause_id ? {...r, scva_report_original_clause: data.scva_report, validation_status: data.scva_report?.overall_status, validation_reason: data.scva_report?.summary_explanation } : r);
                                return [...prev, { clause_id: data.clause_id, original_text: data.original_text, scva_report_original_clause: data.scva_report, validation_status: data.scva_report?.overall_status, validation_reason: data.scva_report?.summary_explanation, ai_suggestions: [] }];
                            });
                        } else if (eventData.event_type === "clause_ai_suggestion_generated" && eventData.payload) {
                            const data = eventData.payload as ClauseAiSuggestionPayload;
                            setClauseAnalysisResults(prev => prev.map(r => r.clause_id === data.clause_id ? { ...r, ai_suggestions: [...r.ai_suggestions, data] } : r));
                        }
                    } else { // full_contract mode
                        if (eventData.event_type === "full_contract_review_completed" && eventData.payload) {
                            setFullContractReviewReport(eventData.payload as FullContractReviewReport);
                        }
                    }
                    if (eventData.message && (eventData.event_type === "progress" || eventData.event_type === "system_log")) { 
                        sendSystemNotification(`AI (Contract): ${eventData.message}`, "info");
                    }
                    if (eventData.event_type === "fatal_error" || eventData.event_type === "error") {
                        sendSystemNotification(`Contract AI Error: ${eventData.message}`, "error");
                        controller.abort(); // Stop stream on fatal error
                    }
                  } catch (e) { console.warn("SSE JSON Parse Error (ContractPage):", e, "Raw:", message); }
                }
              });
            } catch (streamReadError: any) { 
                sendSystemNotification(`Contract Stream Read Error: ${streamReadError.message}`, "error");
                break; 
            }
          }
        }
        processStream();
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
            sendSystemNotification(`Contract Review Failed: ${error.message}`, "error");
        }
      })
      .finally(() => {
        setIsProcessingContract(false);
        if (pageSseControllerRef.current === controller) pageSseControllerRef.current = null;
      });
  }, [
    isSystemInitialized, contractHelperMode, clientClausesInput, fullContractTextInput, contractType, overallContractCtx, 
    sendSystemNotification
  ]);

  const loadSampleContract = () => {
    setContractType(sampleSalamContractForHelper.contract_type);
    setClientClausesInput(sampleSalamContractForHelper.client_clauses_text);
    setFullContractTextInput(sampleSalamContractForHelper.client_clauses_text);
    setOverallContractCtx(sampleSalamContractForHelper.overall_contract_context);
    sendSystemNotification('Sample Salam Contract loaded into fields.', "info");
  };
  
  // Expose needed functions to RightSidebar (which is in MainLayout) through props passed from App.tsx
  // For now, this page manages its own state and actions directly.
  // The RightSidebar's buttons for contract suite will trigger modals that are part of THIS page, or this page's handlers directly.

  return (
    <div className="p-4 sm:p-6 space-y-6 h-full overflow-y-auto scrollbar-thin">
      <section className="bg-white p-5 rounded-lg shadow-lg space-y-6">
        <h2 className="text-xl font-semibold text-slate-700 mb-1 flex items-center">
            <ShieldCheck size={24} className="mr-2 text-teal-600"/> Shari'ah Contract Suite
        </h2>
        <p className="text-sm text-slate-500 -mt-4 mb-6">
            Validate contract clauses or review full documents for Shari'ah compliance.
        </p>

        {!isSystemInitialized && (
             <div className="p-3 rounded-md text-sm bg-amber-100 text-amber-700 border-l-4 border-amber-500 flex items-start">
                <InfoIcon size={20} className="mr-2 flex-shrink-0"/>
                <span>System not fully initialized. Please ensure backend is set up for optimal AI context and rule access. Contract validation quality may be affected.</span>
            </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="inline-flex rounded-md shadow-sm" role="group">
                <button type="button" onClick={() => setContractHelperMode('clause_by_clause')} className={`btn-toggle ${contractHelperMode === 'clause_by_clause' ? 'btn-toggle-active !bg-teal-600 !border-teal-600' : '!border-slate-300'}`}>
                    <ListChecks size={16} className="inline mr-1.5"/> Clause-by-Clause
                </button>
                <button type="button" onClick={() => setContractHelperMode('full_contract')} className={`btn-toggle ${contractHelperMode === 'full_contract' ? 'btn-toggle-active !bg-teal-600 !border-teal-600' : '!border-slate-300'}`}>
                    <FileSearch2 size={16} className="inline mr-1.5"/> Full Contract Review
                </button>
            </div>
            <button onClick={loadSampleContract} className="btn-secondary-small flex items-center self-start sm:self-center">
                <FileSignature size={14} className="mr-1"/> Load Sample
            </button>
        </div>
        
        <div>
            <label htmlFor="contractType" className="block text-sm font-medium text-slate-700">Contract Type:</label>
            <select id="contractType" value={contractType} onChange={(e) => setContractType(e.target.value)} className="mt-1 input-field">
                <option>Salam</option><option>Mudarabah</option><option>Murabaha</option><option>Ijarah</option><option>Istisna'a</option><option>Wakala</option><option>Partnership</option><option>General Contract</option>
            </select>
        </div>

        {contractHelperMode === 'clause_by_clause' && (
            <div>
                <label htmlFor="clientClauses" className="block text-sm font-medium text-slate-700 mt-3">Proposed Clauses (one clause per line):</label>
                <textarea id="clientClauses" value={clientClausesInput} onChange={(e) => setClientClausesInput(e.target.value)} rows={10} className="mt-1 input-field font-mono text-xs" placeholder="e.g., Article 1: The Mudarib guarantees capital..."/>
            </div>
        )}
        {contractHelperMode === 'full_contract' && (
            <div>
                <label htmlFor="fullContractInput" className="block text-sm font-medium text-slate-700 mt-3">Full Contract Text:</label>
                <textarea id="fullContractInput" value={fullContractTextInput} onChange={(e) => setFullContractTextInput(e.target.value)} rows={15} className="mt-1 input-field font-mono text-xs" placeholder="Paste the entire proposed contract text here..."/>
            </div>
        )}
         <div>
            <label htmlFor="overallContractCtx" className="block text-sm font-medium text-slate-700 mt-3">Overall Contract Context/Purpose (Optional):</label>
            <textarea id="overallContractCtx" value={overallContractCtx} onChange={(e) => setOverallContractCtx(e.target.value)} rows={2} className="mt-1 input-field" placeholder="e.g., Amendment to existing agreement dated X, for Y purpose."/>
        </div>

        <button onClick={handleValidateContractTerms} disabled={isProcessingContract} className="w-full btn-teal mt-4 py-2.5 text-base">
            {isProcessingContract ? <Loader2 className="inline mr-2 h-5 w-5 animate-spin"/> : '🛡️ '}
            {contractHelperMode === 'clause_by_clause' ? 'Validate Clauses & Get AI Feedback' : 'Review Full Contract with AI'}
        </button>
      </section>

      {/* Display Area for Contract Analysis Results */}
      {(contractHelperMode === 'clause_by_clause' && clauseAnalysisResults.length > 0) && (
        <section className="mt-8 space-y-6">
          <h3 className="text-lg font-semibold text-slate-700 flex items-center">Clause Analysis Results:</h3>
          {clauseAnalysisResults.map(result => (
            <div key={result.clause_id} className="p-4 border border-slate-300 rounded-lg bg-white shadow-md">
                <p className="text-xs text-slate-500 mb-1">Clause ID: {result.clause_id}</p>
                <div className="original-clause mb-3">
                    <p className="text-sm font-medium text-slate-800">Original Client Clause:</p>
                    <pre className="text-xs bg-slate-100 p-2 rounded whitespace-pre-wrap font-mono border border-slate-200">{result.original_text}</pre>
                </div>
                {result.skipped ? <p className="text-sm text-slate-600 italic p-2 bg-yellow-50 border-yellow-200 rounded">Skipped: {result.skipped_reason}</p> : <>
                    <div className={`text-sm mt-1 font-semibold p-1.5 rounded-md inline-block border ${
                        result.validation_status?.toLowerCase().includes("compliant") ? "bg-green-50 text-green-700 border-green-300" :
                        result.validation_status?.toLowerCase().includes("non-compliant") ? "bg-red-50 text-red-700 border-red-300" :
                        result.validation_status?.toLowerCase().includes("expert review") ? "bg-yellow-50 text-yellow-700 border-yellow-300" :
                        "bg-slate-100 text-slate-600 border-slate-300"
                    }`}>
                        Initial Validation: {result.validation_status || 'Pending...'}
                    </div>
                    {result.validation_reason && <p className="text-xs text-slate-600 mt-1 pl-1">{result.validation_reason}</p>}
                    
                    {result.ai_suggestions.length > 0 && <h4 className="text-sm font-medium text-slate-700 mt-4 mb-2">AI Suggestions for this Clause:</h4>}
                    {result.ai_suggestions.map((suggPack, idx) => (
                        <div key={idx} className="mt-2">
                            <SuggestionCard 
                                suggestionPackage={suggPack} 
                                onAccept={() => { navigator.clipboard.writeText(suggPack.suggestion_details.proposed_text); sendSystemNotification(`Suggested text for clause ${result.clause_id} copied!`, "success");}}
                                onReject={() => { sendSystemNotification(`Suggestion for clause ${result.clause_id} rejected.`, "info");}}
                                isHighlighted={(suggPack.suggestion_details.confidence_score || 0) >= minConfidenceForHighlight}
                            />
                        </div>
                    ))}
                </>}
            </div>
          ))}
        </section>
      )}

      {(contractHelperMode === 'full_contract' && fullContractReviewReport) && (
        <section className="mt-8 bg-white p-5 rounded-lg shadow-lg">
            <FullContractReviewDisplay report={fullContractReviewReport} onCopyRecommendation={(text) => {navigator.clipboard.writeText(text); sendSystemNotification("Recommendation copied!", "success");}} />
        </section>
      )}
      
      {/* Progress Log Display (optional, could be in a sidebar or modal) */}
      {isProcessingContract && contractPageProgressLog.length > 0 && (
          <section className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-md shadow-inner">
              <h4 className="text-sm font-medium text-slate-600 mb-2">AI Processing Log:</h4>
              <div className="text-xs space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                  {contractPageProgressLog.map((log, idx) => (
                      <p key={idx} className={`whitespace-pre-wrap ${log.event_type === 'error' || log.event_type === 'fatal_error' ? 'text-red-600' : 'text-slate-500'}`}>
                          [{log.event_type}{log.step_code ? `:${log.step_code}` : ''}{log.agent_name ? ` (${log.agent_name})` : ''}]: {log.message}
                      </p>
                  ))}
              </div>
          </section>
      )}

    </div>
  );
};


// Dedicated component for displaying the FullContractReviewReport
const FullContractReviewDisplay: React.FC<{report: FullContractReviewReport, onCopyRecommendation: (text: string) => void}> = ({ report, onCopyRecommendation }) => {
    // (This is the detailed rendering logic from App_v2.tsx's renderFullContractReviewReportChat, adapted)
    if (report.error) return <p className="text-red-600 p-3 bg-red-50 border border-red-200 rounded">Error in report: {report.error}</p>;
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-3">
                Full Contract Review Report
            </h3>
            <div className="p-4 border border-slate-300 rounded-lg bg-white shadow">
                 <h4 className="text-md font-semibold text-sky-700 mb-2">Overall Assessment & Summary</h4>
                 <p className={`text-lg font-bold mb-2 ${ report.overall_contract_assessment?.toLowerCase().includes('revision') || report.overall_contract_assessment?.toLowerCase().includes('non-compliant') ? 'text-red-600' : report.overall_contract_assessment?.toLowerCase().includes('compliant') && !report.overall_contract_assessment?.toLowerCase().includes('issues') ? 'text-green-600' : report.overall_contract_assessment ? 'text-amber-500' : 'text-slate-700' }`}>
                   {report.overall_contract_assessment || 'N/A'}
                 </p>
                <details className="text-sm text-slate-600">
                    <summary className="cursor-pointer hover:text-sky-700 font-medium">View AI Summary & Alignment Notes</summary>
                    <div className="mt-2 pl-4 border-l-2 border-slate-200">
                        <p className="mt-1"><strong className="text-slate-700">AI Contract Summary:</strong> {report.contract_summary_by_ai || 'N/A'}</p>
                        <p className="mt-2"><strong className="text-slate-700">Overall Shari'ah Alignment Notes:</strong> {report.overall_shariah_alignment_notes || 'N/A'}</p>
                    </div>
                </details>
            </div>

            {report.identified_clauses_with_issues && report.identified_clauses_with_issues.length > 0 && (
                <div className="mt-4 p-4 border border-slate-300 rounded-lg bg-white shadow">
                    <h4 className="text-md font-semibold text-sky-700 mb-3">Detailed Findings & Recommendations:</h4>
                    <div className="space-y-4">
                        {report.identified_clauses_with_issues.map((issue, index) => {
                            // ... (same detailed issue rendering as in App_v2.tsx's renderFullContractReviewReportChat) ...
                            // Be sure to use onCopyRecommendation for the copy button
                             let severityColorClass = 'text-slate-600 bg-slate-100 border-slate-300';
                             if (issue.severity?.toLowerCase().includes('high')) {
                               severityColorClass = 'text-red-700 bg-red-100 border-red-400';
                             } else if (issue.severity?.toLowerCase().includes('medium')) {
                               severityColorClass = 'text-amber-700 bg-amber-100 border-amber-400';
                             } else if (issue.severity?.toLowerCase().includes('low')) {
                               severityColorClass = 'text-green-700 bg-green-100 border-green-400';
                             } else if (issue.severity?.toLowerCase().includes('information')) {
                               severityColorClass = 'text-blue-700 bg-blue-100 border-blue-400';
                             }

                             return (
                                <div key={index} className="p-3 border border-slate-200 rounded-md hover:shadow-md transition-shadow bg-slate-50">
                                  <div className="mb-2"> <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${severityColorClass}`}> Severity: {issue.severity || 'N/A'} </span> </div>
                                  <p className="text-xs text-slate-500 mb-1">Original Contract Snippet (Identified by AI):</p>
                                  <blockquote className="text-xs italic border-l-2 border-slate-400 pl-3 my-1 bg-slate-100 p-2 rounded max-h-28 overflow-y-auto"> {issue.original_clause_text_snippet || "N/A"} </blockquote>
                                  <p className="text-sm mt-2"> <strong className="text-slate-700">Issue/Concern:</strong> {issue.issue_or_concern || 'N/A'} </p>
                                  {issue.relevant_shariah_rule_ids && issue.relevant_shariah_rule_ids.length > 0 && ( <p className="text-xs mt-1 text-slate-600"> <strong>Relevant Rule(s):</strong> {issue.relevant_shariah_rule_ids.join(', ')} </p> )}
                                  <div className="mt-2"> <p className="text-sm font-medium text-emerald-700">AI Recommended Action/Modification:</p> <pre className="text-xs bg-emerald-50 p-2 mt-1 rounded border border-emerald-200 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto"> {issue.recommended_action_or_modification || 'N/A'} </pre> <button onClick={() => onCopyRecommendation(issue.recommended_action_or_modification || '')} className="text-xs mt-1 px-2 py-0.5 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded" disabled={!issue.recommended_action_or_modification}> Copy Recommendation </button> </div>
                                </div>
                              );
                        })}
                    </div>
                </div>
            )}
             {/* ... (General Recommendations display) ... */}
        </div>
    );
};


export default ContractVerificationPage;