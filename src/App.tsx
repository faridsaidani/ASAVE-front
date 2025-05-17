/* eslint-disable @typescript-eslint/no-explicit-any */
// src/App.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileUploader from './components/FileUploader';
import Sidebar from './components/Sidebar';
import SuggestionCard from './components/SuggestionCard';
import {
    initializeSystem,
    getAssistanceStreamUrl, // For FAS document editor
    getApiStatus,
    type InitResponse,
    type ApiStatusResponse,
    type SSEEventData,
    type ValidatedSuggestionPackage
} from './services/api';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Upload, Settings, AlertTriangle, CheckCircle, Info, FileText,
    MessageSquare, Edit3, Loader2, Scissors, Eye, Edit, ServerCrash, ShieldCheck, ListChecks, FileSignature, FileSearch2, BookOpen, Columns // Lucide icons
} from 'lucide-react';

// --- Type Definitions ---
// (Keep MarkerApiResponse, FallbackExtractedPdfResponse, ClientClauseInput, 
//  ClauseValidationPayload, ClauseAiSuggestionPayload, ClauseSkippedPayload, 
//  ClauseAnalysisResult from previous full App.tsx versions)

interface FallbackExtractedPdfResponse {
    status: string;
    pages?: Array<{ page_number: number; content: string }>;
    message?: string;
    document_info?: any;
    [key: string]: any;
}

interface MarkerApiResponse {
    status: string;
    extracted_text?: string;
    message?: string;
    document_info?: any;
    [key: string]: any;
}

interface ClientClauseInput { // For the payload to the contract validation API
    clause_id: string;
    text: string;
}
interface ClauseValidationPayload { // Expected from SSE for validation of original clause
    clause_id: string;
    original_text: string;
    scva_report: any; 
}
interface ClauseAiSuggestionPayload extends ValidatedSuggestionPackage { // For AI's suggestion on a clause
    clause_id: string;
}
// interface ClauseSkippedPayload {
//     clause_id: string;
//     original_text: string;
//     reason: string;
// }

interface LibraryPdfItem {
  name: string;
  type: "file" | "directory"; // And potentially 'directory' if backend lists them
  path?: string; // For files within directories: "dirname/filename.pdf"
  files?: string[]; // For directories
}
interface SessionInfo {
  session_id: string;
  path: string;
  has_fas_db: boolean;
  has_ss_db: boolean;
  last_modified: string;
}


interface FullContractReviewReport {
    overall_assessment: string;
    contract_summary_by_ai: string;
    identified_clauses_with_issues: Array<{
        original_clause_text_snippet: string; // Snippet of the clause AI is referring to
        issue_or_concern: string;
        relevant_shariah_rule_ids?: string[]; // Optional
        recommended_action_or_modification: string; // AI's suggested fix/wording
        severity: "High - Clear Non-Compliance" | "Medium - Potential Risk/Ambiguity" | "Low - Suggestion for Enhancement" | "Information" | string; // Allow string for flexibility
    }>;
    general_recommendations?: string[]; // Optional
    overall_shariah_alignment_notes: string;
    error?: string;
}

// For storing results of contract analysis in frontend state
interface ClauseAnalysisResult {
  clause_id: string;
  original_text: string;
  validation_status?: string;
  validation_reason?: string;
  scva_report_original_clause?: any;
  ai_suggestions: ValidatedSuggestionPackage[];
  processing_message?: string;
  skipped?: boolean;
  skipped_reason?: string;
}


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

// Sample Salam Contract for easy loading in Contract Helper
const sampleSalamContractForHelper = {
    contract_type: "Salam",
    client_clauses_text: // Multiline string for easier pasting into textarea
`Al Baraka Bank Algeria – Ouargla Branch, registered under RC 06B093, hereinafter referred to as “the Bank” or Rab al-Salam.
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


type AppView = 'fas_editor' | 'contract_suite';

const App: React.FC = () => {
  // --- App View State ---
  const [currentAppView, setCurrentAppView] = useState<AppView>('fas_editor');

  // --- Initialization State ---
  const [fasFilesForInit, setFasFilesForInit] = useState<FileList | null>(null);
  const [ssFilesForInit, setSsFilesForInit] = useState<FileList | null>(null);
  const [rulesFileForInit, setRulesFileForInit] = useState<File | null>(null);
  const [isSystemInitialized, setIsSystemInitialized] = useState<boolean>(false);
  
  // --- FAS Document Editor State ---
  const [fasFileForViewing, setFasFileForViewing] = useState<File | null>(null);
  const [currentMarkdownContent, setCurrentMarkdownContent] = useState<string>('');
  const [currentDocumentId, setCurrentDocumentId] = useState<string>('');
  const [selectedText, setSelectedText] = useState<string>('');
  const markdownEditorRef = useRef<HTMLTextAreaElement>(null);
  const markdownPreviewRef = useRef<HTMLDivElement>(null);
  const [fasEditorViewMode, setFasEditorViewMode] = useState<'preview' | 'edit'>('preview'); 

  // --- Contract Helper State ---
  const [contractHelperMode, setContractHelperMode] = useState<'full_contract' | 'clause_by_clause'>('clause_by_clause');
  const [contractType, setContractType] = useState<string>(sampleSalamContractForHelper.contract_type);
  const [clientClausesInput, setClientClausesInput] = useState<string>(sampleSalamContractForHelper.client_clauses_text);
  const [fullContractTextInput, setFullContractTextInput] = useState<string>(''); // For full contract review
  const [overallContractCtx, setOverallContractCtx] = useState<string>(sampleSalamContractForHelper.overall_contract_context);
  const [clauseAnalysisResults, setClauseAnalysisResults] = useState<ClauseAnalysisResult[]>([]);
  const [fullContractReviewReport, setFullContractReviewReport] = useState<FullContractReviewReport | null>(null);


  // --- API Interaction State ---
  const [progressLog, setProgressLog] = useState<SSEEventData[]>([]);
  const [finalSuggestionsForFAS, setFinalSuggestionsForFAS] = useState<ValidatedSuggestionPackage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false); 
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [isProcessingContract, setIsProcessingContract] = useState<boolean>(false);
  const [apiMessage, setApiMessage] = useState<{type: 'info' | 'success' | 'error' | 'warning', text: string} | null>(null);
  const sseControllerRef = useRef<AbortController | null>(null);

  const [libraryPdfs, setLibraryPdfs] = useState<LibraryPdfItem[]>([]);
  const [selectedLibraryFas, setSelectedLibraryFas] = useState<string[]>([]); // Filenames
  const [selectedLibrarySs, setSelectedLibrarySs] = useState<string[]>([]);   // Filenames
  
  const [availableSessions, setAvailableSessions] = useState<SessionInfo[]>([]);
  const [selectedSessionToLoad, setSelectedSessionToLoad] = useState<string>('');
  const [newSessionName, setNewSessionName] = useState<string>('');
  const [overwriteSession, setOverwriteSession] = useState<boolean>(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);


  // Check API status on initial load
  useEffect(() => { /* ... same as before ... */ 
    const checkInitialApiStatus = async () => {
      try {
        const statusData = await getApiStatus();
        if (statusData?.asave_initialized) setIsSystemInitialized(true);
        setApiMessage({type: 'info', text: statusData?.asave_initialized ? 'ASAVE backend initialized.' : 'ASAVE backend needs initialization for full context features.'});
      } catch (error) { setApiMessage({type: 'error', text: 'Could not connect to ASAVE API. Ensure backend is running.'}); }
    };
    checkInitialApiStatus();
  }, []);

  const handleInitializeBackend = async () => { /* ... same as before ... */ 
    if (!fasFilesForInit) { setApiMessage({type:'error', text:"Upload FAS PDFs."}); return; }
    setIsLoading(true); setApiMessage({type: 'info', text: 'Initializing backend...'});
    const formData = new FormData();
    Array.from(fasFilesForInit).forEach(f => formData.append('fas_files', f, f.name));
    if (ssFilesForInit) Array.from(ssFilesForInit).forEach(f => formData.append('ss_files', f, f.name));
    if (rulesFileForInit) formData.append('shariah_rules_explicit_file', rulesFileForInit, rulesFileForInit.name);
    try {
      const data = await initializeSystem(formData);
      setApiMessage({type: data.status === 'success' ? 'success' : 'error', text: `Backend Init: ${data.message}`});
      if (data.status === 'success') setIsSystemInitialized(true);
    } catch (e:any) { setApiMessage({type: 'error', text: `Backend Init Failed: ${e.message}`}); }
    setIsLoading(false);
  };

  const handleFasFileForProcessing = async (file: File | null) => { /* ... same as before (Marker + Fallback) ... */
    setFasFileForViewing(file);
    if (!file) { setCurrentMarkdownContent(''); setCurrentDocumentId(''); return; }
    setIsExtractingText(true);
    setApiMessage({type: 'info', text: `Processing ${file.name}...`});
    setCurrentMarkdownContent(''); setCurrentDocumentId(file.name); setSelectedText('');
    setFinalSuggestionsForFAS([]); setProgressLog([]);
    const formData = new FormData(); formData.append('pdf_file', file);
    try {
      let markdownText = ''; let docInfo: any = { filename: file.name };
      try {
        const markerResponse = await axios.post<MarkerApiResponse>(`${API_BASE_URL}/extract_text_from_pdf_file_marker`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        if (markerResponse.data.status === 'success' && typeof markerResponse.data.extracted_text === 'string') {
          markdownText = markerResponse.data.extracted_text; docInfo = markerResponse.data.document_info || markerResponse.data;
          setApiMessage({type: 'success', text: `Extracted via Marker: ${docInfo.filename}`});
        } else { throw new Error(markerResponse.data.message || "Marker extraction failed"); }
      } catch (markerError) {
        setApiMessage({type: 'warning', text: `Marker failed: ${(markerError as Error).message}. Trying fallback...`});
        // ... (Fallback logic from previous App.tsx) ...
        const fallbackResponse = await axios.post<FallbackExtractedPdfResponse>(`${API_BASE_URL}/extract_text_from_pdf?reformat_ai=true`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        if (fallbackResponse.data.status === 'success' && fallbackResponse.data.pages?.length) {
          markdownText = fallbackResponse.data.pages.map((p: { page_number: any; content: string; }) => `<!-- Page ${p.page_number} -->\n${p.content.trim()}`).join('\n\n<hr />\n\n');
          docInfo = fallbackResponse.data.document_info || docInfo;
          setApiMessage({type: 'success', text: `Fallback extraction: ${docInfo.filename}`});
        } else { throw new Error(fallbackResponse.data.message || "Fallback extraction failed"); }
      }
      setCurrentMarkdownContent(markdownText.trimStart()); setCurrentDocumentId(docInfo.filename);
    } catch (e: any) { setApiMessage({type: 'error', text: `PDF Processing Failed: ${e.message}`}); setCurrentMarkdownContent('');}
    setIsExtractingText(false);
  };

  // // --- Text Selection Logic (Combined for FAS Editor) ---
  // useEffect(() => { /* ... same as before ... */ 
  //   if (currentAppView !== 'fas_editor') return; // Only attach for FAS editor
  //   const editor = markdownEditorRef.current; const previewArea = markdownPreviewRef.current;
  //   let selectionHandler: (() => void) | null = null;
  //   const clearPreviousListeners = () => { /* ... */ }; clearPreviousListeners();
  //   if (fasEditorViewMode === 'edit' && editor) { /* ... */ }
  //   else if (fasEditorViewMode === 'preview' && previewArea) { /* ... */ }
  //   else { setSelectedText(''); }
  //   return clearPreviousListeners;
  // }, [currentAppView, fasEditorViewMode, currentMarkdownContent]); // Re-run if view or content changes

  useEffect(() => {
    const editor = markdownEditorRef.current;
    const previewArea = markdownPreviewRef.current;

    if (fasEditorViewMode === 'edit' && editor) {
      const updateSelectionFromTextarea = () => {
        const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
        if(selected.trim()){ setSelectedText(selected.trim()); }
      };
      editor.addEventListener('select', updateSelectionFromTextarea);
      editor.addEventListener('keyup', updateSelectionFromTextarea);
      editor.addEventListener('mouseup', updateSelectionFromTextarea);
      // Add focus to re-check selection when editor gets focus
      editor.addEventListener('focus', updateSelectionFromTextarea); 
      return () => {
        editor.removeEventListener('select', updateSelectionFromTextarea);
        editor.removeEventListener('keyup', updateSelectionFromTextarea);
        editor.removeEventListener('mouseup', updateSelectionFromTextarea);
        editor.removeEventListener('focus', updateSelectionFromTextarea);
      };
    } else if (fasEditorViewMode === 'preview' && previewArea) {
      // For preview, rely on a global-like mouseup if selection is within the preview area
      const handlePreviewMouseUp = () => {
        const selection = window.getSelection();
        const selected = selection?.toString().trim();
        if (selected && selection?.anchorNode && previewArea.contains(selection.anchorNode)) {
            setSelectedText(selected);
        }
      };
      document.addEventListener('mouseup', handlePreviewMouseUp); // More general for rendered content
      return () => {
        document.removeEventListener('mouseup', handlePreviewMouseUp);
      };
    }
  }, [fasEditorViewMode]);


  const clearCurrentSelection = () => { /* ... same as before ... */ 
    setSelectedText(''); window.getSelection()?.empty();
    if (markdownEditorRef.current && fasEditorViewMode === 'edit') { /* ... */ }
  };

  // Generic SSE Handler - same as before
  const startSSEProcessing = useCallback(async ( /* params */ 
    url: string, 
    payload: any, 
    onEvent: (eventData: SSEEventData) => void, 
    onComplete: () => void, 
    onError: (error: Error) => void,
    onFinally?: () => void
  ) => {
    // ... (Full SSE logic from previous App.tsx, ensuring isLoading/isProcessingContract is handled in onFinally)
    setIsLoading(true); // This will be the general AI assistance spinner
    setProgressLog([{event_type: "system_log", message: "🚀 Requesting AI processing...", step_code: "STREAM_REQUEST_START"}]);
    if (sseControllerRef.current) sseControllerRef.current.abort();
    const controller = new AbortController();
    sseControllerRef.current = controller;
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) { const et = await response.text(); throw new Error(`API: ${response.status} - ${et}`);}
      if (!response.body) throw new Error("No response body.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let sseBuffer = '';
      async function processStream() {
        while (true) {
          try {
            const { done, value } = await reader.read();
            if (controller.signal.aborted) { break; }
            if (done) { onComplete(); break; }
            sseBuffer += decoder.decode(value, { stream: true });
            const messages = sseBuffer.split('\n\n'); sseBuffer = messages.pop() || ''; 
            messages.forEach(message => {
              if (message.startsWith('data: ')) {
                try {
                  const eventData = JSON.parse(message.substring(6)) as SSEEventData;
                  setProgressLog(p => [...p, eventData]); onEvent(eventData);
                } catch (e) { console.warn("SSE JSON Parse Error:", e, "Raw:", message); }
              }
            });
          } catch (streamReadError: any) { onError(streamReadError); break; }
        }
      }
      await processStream();
    } catch (error: any) { onError(error); }
    finally { setIsLoading(false); if (onFinally) onFinally(); }
  }, []);

    const handleExportMarkdown = () => {
      if (!currentMarkdownContent) {
        setApiMessage({type: 'warning', text: "No Markdown content to export."});
        return;
      }
      const filename = currentDocumentId ? `${currentDocumentId.replace('.pdf', '') || 'document'}.md` : 'asave_export.md';
      const blob = new Blob([currentMarkdownContent], { type: 'text/markdown;charset=utf-8;' });
      const link = document.createElement("a");
      if (link.download !== undefined) { // feature detection
          const url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", filename);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setApiMessage({type: 'success', text: `Markdown file '${filename}' download initiated.`});
      } else {
          setApiMessage({type: 'error', text: "Markdown export not supported by your browser (link.download undefined)."});
      }
  };

  const handleGetAIAssistanceForFAS = () => { /* ... same as before, uses startSSEProcessing ... */ 
    if (!selectedText.trim()) { setApiMessage({type: 'error', text: "Please select text."}); return; }
    if (!isSystemInitialized && currentMarkdownContent) { setApiMessage({type: 'warning', text: "Backend KB not initialized."});}
    else if (!isSystemInitialized && !currentMarkdownContent) { setApiMessage({type: 'error', text: "Initialize backend & load FAS doc."}); return; }
    
    setFinalSuggestionsForFAS([]); // Clear previous FAS suggestions
    setApiMessage({type: 'info', text: 'AI (FAS Editor) is thinking... 🧠'});
    const payload = { selected_text_from_fas: selectedText, fas_document_id: currentDocumentId };
    startSSEProcessing(
      getAssistanceStreamUrl(), payload,
      (eventData) => {
        if (eventData.event_type === "validated_suggestion_package" && eventData.payload) {
          setFinalSuggestionsForFAS(prev => [...prev, eventData.payload as ValidatedSuggestionPackage]);
        }
        if (eventData.message && eventData.event_type === "progress") { setApiMessage({type: 'info', text: `AI (FAS): ${eventData.message}`}); }
        if (eventData.event_type === "fatal_error") { setApiMessage({type:'error', text: `Stream error: ${eventData.message}`}); sseControllerRef.current?.abort(); }
      },
      () => setApiMessage(prev => (prev?.text.includes('AI is thinking') || !prev) ? {type: 'success', text: 'AI FAS analysis complete!'} : prev),
      (error) => { if (error.name !== 'AbortError') setApiMessage({type: 'error', text: `AI FAS Assist Failed: ${error.message}`}); else setApiMessage({type: 'info', text: 'AI FAS assistance cancelled.'}); }
    );
  };

  const handleValidateContractTerms = () => {
    if (!isSystemInitialized) {
      setApiMessage({type: 'error', text: "Please initialize the backend system first (Section 1) before validating contracts."});
      return;
    }
    if (!clientClausesInput.trim() && !fullContractTextInput.trim()) {
        setApiMessage({type: 'error', text: contractHelperMode === 'clause_by_clause' ? "Please enter contract clauses." : "Please enter the full contract text."});
        return;
    }
    
    let clausesForApi: ClientClauseInput[] = [];
    let contractTextForApi = "";

    if (contractHelperMode === 'clause_by_clause') {
        clausesForApi = clientClausesInput.split('\n')
            .map((text, index) => ({ clause_id: `user_c${index + 1}`, text: text.trim() }))
            .filter(clause => clause.text.length > 0);
        if (!clausesForApi.length) {setApiMessage({type:'error', text:"No valid clauses parsed."}); return;}
    } else { // full_contract mode
        contractTextForApi = fullContractTextInput;
    }

    setClauseAnalysisResults([]);
    setFullContractReviewReport(null);
    setApiMessage({type: 'info', text: `AI is reviewing your ${contractHelperMode === 'clause_by_clause' ? 'clauses' : 'full contract'}... 🧠`});
    
    const endpoint = contractHelperMode === 'clause_by_clause' 
        ? `${API_BASE_URL}/validate_contract_terms_stream` 
        : `${API_BASE_URL}/review_full_contract_stream`;

    const payload = contractHelperMode === 'clause_by_clause'
        ? { contract_type: contractType, client_clauses: clausesForApi, overall_contract_context: overallContractCtx }
        : { full_contract_text: contractTextForApi, contract_type: contractType };

    startSSEProcessing(
      endpoint, payload,
      (eventData) => { // onEvent for contract validation
      console.log("SSE Event Data:", eventData);
        if (contractHelperMode === 'clause_by_clause') {
            if (eventData.event_type === "clause_validation_result" && eventData.payload) {
                const data = eventData.payload as ClauseValidationPayload;
                setClauseAnalysisResults(prev => { /* ... update or add logic ... */ 
                    const existing = prev.find(r => r.clause_id === data.clause_id);
                    if (existing) return prev.map(r => r.clause_id === data.clause_id ? {...r, scva_report_original_clause: data.scva_report, validation_status: data.scva_report?.overall_status, validation_reason: data.scva_report?.summary_explanation } : r);
                    return [...prev, { clause_id: data.clause_id, original_text: data.original_text, scva_report_original_clause: data.scva_report, validation_status: data.scva_report?.overall_status, validation_reason: data.scva_report?.summary_explanation, ai_suggestions: [] }];
                });
            } else if (eventData.event_type === "clause_ai_suggestion_generated" && eventData.payload) {
                const data = eventData.payload as ClauseAiSuggestionPayload;
                setClauseAnalysisResults(prev => prev.map(r => r.clause_id === data.clause_id ? { ...r, ai_suggestions: [...r.ai_suggestions, data] } : r));
            } else if (eventData.event_type === "clause_skipped" && eventData.payload) { /* ... */ }
        } else { // full_contract mode
            if (eventData.event_type === "full_contract_review_completed" && eventData.payload) {
                console.log("Full Contract Review Report:", eventData.payload);
                setFullContractReviewReport(eventData.payload as FullContractReviewReport);
                
            }
        }
        if (eventData.message && eventData.event_type === "progress") { setApiMessage({type: 'info', text: `AI (Contract): ${eventData.message}`});}
        if (eventData.event_type === "fatal_error") { /* ... */ }
      },
      () => setApiMessage(prev => (prev?.text.includes('AI is reviewing') || !prev) ? {type: 'success', text: 'Contract review complete!'} : prev),
      (error) => { if (error.name !== 'AbortError') setApiMessage({type: 'error', text: `Contract Review Failed: ${error.message}`}); else setApiMessage({type: 'info', text: 'Contract review cancelled.'}); },
      () => setIsProcessingContract(false) // onFinally
    );
  };
  
  const loadSampleContract = () => { /* ... same as before ... */ 
    setContractType(sampleSalamContractForHelper.contract_type);
    setClientClausesInput(sampleSalamContractForHelper.client_clauses_text);
    setOverallContractCtx(sampleSalamContractForHelper.overall_contract_context);
    setFullContractTextInput(sampleSalamContractForHelper.client_clauses_text); // Also load into full contract input
    setApiMessage({type: 'info', text: 'Sample Salam Contract loaded into fields.'});
  };

  const fetchLibraryPdfs = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/list_library_pdfs`);
      if (response.data.status === 'success') {
        setLibraryPdfs(response.data.pdf_files);
        setApiMessage({type: 'info', text: `Found ${response.data.pdf_files.length} items in PDF library.`});
      } else {
        setApiMessage({type: 'error', text: `Failed to list library PDFs: ${response.data.message}`});
      }
    } catch (error: any) {
      setApiMessage({type: 'error', text: `Error fetching library PDFs: ${error.message}`});
    }
  };

  const fetchSessions = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/list_sessions`);
      if (response.data.status === 'success') {
        setAvailableSessions(response.data.sessions);
      } else {
        setApiMessage({type: 'error', text: `Failed to list sessions: ${response.data.message}`});
      }
    } catch (error: any) {
      setApiMessage({type: 'error', text: `Error fetching sessions: ${error.message}`});
    }
  };

  // Call these on component mount or when needed
  useEffect(() => {
    fetchLibraryPdfs();
    fetchSessions();
  }, []);

  const handleInitializeModified = async () => {
    // This function now needs to decide whether to:
    // 1. Load an existing session.
    // 2. Create a new session with uploaded files and/or library files.
    // 3. Just use temporary uploaded files without saving a session explicitly.

    setIsLoading(true);
    setApiMessage({type: 'info', text: 'Processing initialization request...'});
    
    const formData = new FormData();

    if (selectedSessionToLoad) {
        formData.append('load_session_id', selectedSessionToLoad);
    } else {
        // If not loading, we might be saving a new session or using uploads/library files
        if (newSessionName.trim()) {
            formData.append('save_as_session_name', newSessionName.trim());
            if (overwriteSession) {
                formData.append('overwrite_session', 'true');
            }
        }

        // Add uploaded files
        if (fasFilesForInit) Array.from(fasFilesForInit).forEach(f => formData.append('fas_files_upload', f, f.name));
        if (ssFilesForInit) Array.from(ssFilesForInit).forEach(f => formData.append('ss_files_upload', f, f.name));
        if (rulesFileForInit) formData.append('shariah_rules_explicit_file_upload', rulesFileForInit, rulesFileForInit.name);

        // Add selected library files
        if (selectedLibraryFas.length > 0) formData.append('library_fas_filenames', JSON.stringify(selectedLibraryFas));
        if (selectedLibrarySs.length > 0) formData.append('library_ss_filenames', JSON.stringify(selectedLibrarySs));
    }
    
    // Ensure at least some source of files is provided if not loading a session
    if (!selectedSessionToLoad && !fasFilesForInit && !ssFilesForInit && selectedLibraryFas.length === 0 && selectedLibrarySs.length === 0) {
        setApiMessage({type:'error', text: "Please select files to process or a session to load."});
        setIsLoading(false);
        return;
    }


    try {
      // The /initialize endpoint in the backend is now modified to handle these params
      const response = await axios.post<InitResponse & {session_id?: string}>(`${API_BASE_URL}/initialize`, formData, {
         headers: { 'Content-Type': 'multipart/form-data' },
      });

      const data = response.data;
      setApiMessage({type: data.status === 'success' ? 'success' : 'error', text: `Init ${data.status}: ${data.message}`});
      if (data.status === 'success') {
        setIsSystemInitialized(true);
        setCurrentSessionId(data.session_id || null); // Backend should return the active session_id
        fetchSessions(); // Refresh session list
        // Clear input fields for new session name after successful save
        if (newSessionName.trim() && !selectedSessionToLoad) setNewSessionName(''); 
      } else {
        setIsSystemInitialized(false);
        setCurrentSessionId(null);
      }
    } catch (error: any) {
      setApiMessage({type: 'error', text: `Initialization request failed: ${error.response?.data?.message || error.message}`});
      setIsSystemInitialized(false);
      setCurrentSessionId(null);
    }
    setIsLoading(false);
  };
  const handleSessionSelection = (sessionId: string) => {
    setSelectedSessionToLoad(sessionId);
    const session = availableSessions.find(s => s.session_id === sessionId);
    if (session) {
      setNewSessionName(session.path); // Set the name to the session path
      setCurrentSessionId(session.session_id);
    }
  };


  const handleAcceptSuggestion = (suggestionPackageToAccept: ValidatedSuggestionPackage) => {
    const originalMarkdown = suggestionPackageToAccept.suggestion_details?.original_text || selectedText;
    const proposedMarkdown = suggestionPackageToAccept.suggestion_details?.proposed_text;

    if (currentMarkdownContent.includes(originalMarkdown) && proposedMarkdown && markdownEditorRef.current) {
        const editor = markdownEditorRef.current;
        const currentValue = editor.value; // Use current value from ref if textarea might not have re-rendered state
        const startIndex = currentValue.indexOf(originalMarkdown);

        if (startIndex !== -1) {
            const before = currentValue.substring(0, startIndex);
            const after = currentValue.substring(startIndex + originalMarkdown.length);
            const newContent = before + proposedMarkdown + after;
            
            setCurrentMarkdownContent(newContent); // Update state
            // For immediate visual update in textarea if it's controlled and state update is async:
            editor.value = newContent; 
            
            const newCursorPos = startIndex + proposedMarkdown.length;
            editor.focus();
            editor.setSelectionRange(newCursorPos, newCursorPos);

            setApiMessage({type:'success', text: `Suggestion from ${suggestionPackageToAccept.source_agent_name} applied!`});
            setSelectedText(proposedMarkdown);
        } else {
             setApiMessage({type:'warning', text: `Original snippet not found in editor to auto-apply. Proposed text copied.`});
             if (proposedMarkdown) navigator.clipboard.writeText(proposedMarkdown);
        }
    } else {
        setApiMessage({type:'warning', text: `Could not auto-apply (editor ref or text missing). Proposed text copied.`});
        if (proposedMarkdown) navigator.clipboard.writeText(proposedMarkdown);
    }
    setFinalSuggestionsForFAS(prev => prev.filter(s => s !== suggestionPackageToAccept));
  };

  const handleRejectSuggestion = (suggestionPackageToReject: ValidatedSuggestionPackage) => {
    setApiMessage({type:'info', text: `Suggestion from ${suggestionPackageToReject.source_agent_name} rejected.`});
    setFinalSuggestionsForFAS(prev => prev.filter(s => s !== suggestionPackageToReject));
  };

  // --- Render Logic ---
  const renderFasEditor = () => (
    <section className="bg-white p-5 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-semibold text-slate-700 mb-3 flex items-center">
            <Edit3 size={20} className="mr-2 text-sky-600"/>FAS Document Editor & AI Assistant
        </h2>
        <FileUploader 
            label="Load FAS PDF (Extracts to Markdown)" 
            accept=".pdf" 
            onFilesUploaded={(file) => handleFasFileForProcessing(file as File)} 
            id="fas-marker-uploader" 
        />
        {currentDocumentId && <p className="text-sm text-slate-600 my-2">Editing: <strong>{currentDocumentId}</strong></p>}
        {currentMarkdownContent && (
            <div className="my-3">
                <span className="text-sm font-medium text-slate-700 mr-3">View:</span>
                <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button type="button" onClick={() => setFasEditorViewMode('edit')} className={`btn-toggle ${fasEditorViewMode === 'edit' ? 'btn-toggle-active' : ''}`}>
                        <Edit size={14} className="inline mr-1"/> Edit Raw
                    </button>
                    <button type="button" onClick={() => setFasEditorViewMode('preview')} className={`btn-toggle ${fasEditorViewMode === 'preview' ? 'btn-toggle-active' : ''}`}>
                        <Eye size={14} className="inline mr-1"/> Preview
                    </button>
                    <button 
                      onClick={handleExportMarkdown} 
                      className="btn-secondary-small mt-3"
                    >
                      <Upload size={14} className="mr-1"/> Export Edited Markdown
                    </button>
                </div>
            </div>
        )}
        {fasEditorViewMode === 'edit' ? ( 
          console.log("Markdown Editor Ref:", markdownEditorRef.current),
            <textarea ref={markdownEditorRef} value={currentMarkdownContent} onChange={(e) => setCurrentMarkdownContent(e.target.value)} className="w-full min-h-[50vh] textarea-field" disabled={isExtractingText} placeholder={isExtractingText ? "Extracting..." : "Markdown will appear here."}/>
        ) : ( 
            <div ref={markdownPreviewRef} className="markdown-preview min-h-[50vh]">
                {isExtractingText ? <div className="loading-placeholder"><Loader2/>Loading preview...</div> : currentMarkdownContent ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentMarkdownContent}</ReactMarkdown> : <p>No content.</p>}
                {/* Image Note */}
            </div>
        )}
        {selectedText && fasEditorViewMode === 'edit' && (
          console.log("Selected Text:", selectedText),
             <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-md">
                <p className="text-sm font-medium text-sky-700">Selected for AI Assistance (FAS Editor):</p>
                <pre className="selected-text-preview"><code>{selectedText}</code></pre>
                <div className="flex items-center space-x-2 mt-2">
                    <button onClick={handleGetAIAssistanceForFAS} disabled={isLoading || !selectedText.trim()} className="btn-primary-small flex-grow">
                       {isLoading ? <Loader2 className="inline mr-1 h-4 w-4 animate-spin"/> : <MessageSquare size={14} className="mr-1"/>} Get Suggestions
                    </button>
                    <button onClick={clearCurrentSelection} className="btn-secondary-small"><Scissors size={14}/></button>
                </div>
            </div>
        )}
    </section>
  );

  const renderContractSuite = () => (
    <section className="bg-white p-5 rounded-lg shadow space-y-6">
        <h2 className="text-xl font-semibold text-slate-700 mb-1 flex items-center">
            <ShieldCheck size={22} className="mr-2 text-teal-600"/> Shari'ah Contract Validation Suite
        </h2>
        <p className="text-xs text-slate-500 mb-4">Get AI-powered Shari'ah compliance checks and recommendations for your contract terms.</p>

        {!isSystemInitialized && (
             <div className="p-3 rounded-md text-sm bg-amber-100 text-amber-700 border-l-4 border-amber-500 flex items-start">
                <AlertTriangle size={20} className="mr-2 flex-shrink-0"/>
                <span>Please initialize the backend system first (Section 1) for optimal AI context and rule access. You can still proceed, but AI analysis might be limited.</span>
            </div>
        )}

        <div className="flex justify-between items-center">
            <div className="inline-flex rounded-md shadow-sm" role="group">
                <button type="button" onClick={() => setContractHelperMode('clause_by_clause')} className={`btn-toggle ${contractHelperMode === 'clause_by_clause' ? 'btn-toggle-active' : ''}`}>
                    <ListChecks size={16} className="inline mr-1.5"/> Clause-by-Clause
                </button>
                <button type="button" onClick={() => setContractHelperMode('full_contract')} className={`btn-toggle ${contractHelperMode === 'full_contract' ? 'btn-toggle-active' : ''}`}>
                    <FileSearch2 size={16} className="inline mr-1.5"/> Full Contract Review
                </button>
            </div>
            <button onClick={loadSampleContract} className="btn-secondary-small flex items-center">
                <FileSignature size={14} className="mr-1"/> Load Sample Salam
            </button>
        </div>
        
        <div>
            <label htmlFor="contractType" className="block text-sm font-medium text-slate-700">Contract Type:</label>
            <select id="contractType" value={contractType} onChange={(e) => setContractType(e.target.value)} className="mt-1 input-field">
                <option>Salam</option><option>Mudarabah</option><option>Murabaha</option><option>Ijarah</option><option>Istisna'a</option><option>Wakala</option><option>Partnership</option>
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
            <textarea id="overallContractCtx" value={overallContractCtx} onChange={(e) => setOverallContractCtx(e.target.value)} rows={2} className="mt-1 input-field"/>
        </div>

        <button onClick={handleValidateContractTerms} disabled={isProcessingContract || isLoading} className="w-full btn-teal mt-4 py-2.5">
            {isProcessingContract ? <Loader2 className="inline mr-2 h-5 w-5 animate-spin"/> : '🛡️ '}
            {contractHelperMode === 'clause_by_clause' ? 'Validate Clauses & Get Recommendations' : 'Review Full Contract with AI'}
        </button>

        {/* Display Area for Contract Analysis Results */}
        {contractHelperMode === 'clause_by_clause' && clauseAnalysisResults.length > 0 && (
            <div className="mt-6 space-y-4">
            <h3 className="text-md font-semibold text-slate-700 flex items-center"><ListChecks className="mr-2"/> Clause Analysis Results:</h3>
            {clauseAnalysisResults.map(result => (
                <div key={result.clause_id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 shadow-sm">
                    {/* ... Display logic for each clause result from previous example ... */}
                    <p className="text-xs text-slate-400 mb-1">Clause ID: {result.clause_id}</p>
                    <div className="original-clause mb-2">
                        <p className="text-sm font-medium text-slate-800">Original Client Clause:</p>
                        <pre className="text-xs bg-slate-200 p-2 rounded whitespace-pre-wrap font-mono">{result.original_text}</pre>
                    </div>
                    {result.skipped ? <p className="text-sm text-slate-500 italic">Skipped: {result.skipped_reason}</p> : <>
                        <div className={`text-sm mt-1 font-semibold p-1 rounded-sm inline-block `}>
                            Initial Validation: {result.validation_status || 'Pending...'}
                        </div>
                        {result.ai_suggestions.map((suggPack, idx) => (
                            <div key={idx} className="mt-3 pt-3 border-t border-slate-300">
                                <SuggestionCard suggestionPackage={suggPack} /* ... onAccept/onReject for contract ... */ 
                                    onAccept={() => { navigator.clipboard.writeText(suggPack.suggestion_details.proposed_text); setApiMessage({type:'success', text: `Suggested text copied!`});}}
                                    onReject={() => { console.log("Suggestion rejected"); setApiMessage({type:'info', text: `Suggestion rejected.`});}}
                                />
                            </div>
                        ))}
                    </>}
                </div>
            ))}
            </div>
        )}
        {contractHelperMode === 'full_contract' && fullContractReviewReport && (
    <div className="mt-6 space-y-4">
      <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 mb-3">
        Full Contract Review Report
      </h3>

      {/* Overall Assessment and Summary */}
      <div className="p-4 border border-slate-300 rounded-lg bg-white shadow">
        <h4 className="text-md font-semibold text-sky-700 mb-2">Overall Assessment & Summary</h4>
        <p className={`text-lg font-bold mb-2 ${
            fullContractReviewReport.overall_assessment?.toLowerCase().includes('revision') || fullContractReviewReport.overall_assessment?.toLowerCase().includes('issues') ? 'text-red-600' :
            fullContractReviewReport.overall_assessment?.toLowerCase().includes('compliant') && !fullContractReviewReport.overall_assessment?.toLowerCase().includes('issues') ? 'text-green-600' :
            fullContractReviewReport.overall_assessment ? 'text-amber-600' : 'text-slate-700'
        }`}>
          {fullContractReviewReport.overall_assessment || 'N/A'}
        </p>
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer hover:text-sky-700 font-medium">View AI Summary & Alignment Notes</summary>
          <div className="mt-2 pl-4 border-l-2 border-slate-200">
            <p className="mt-1">
              <strong className="text-slate-700">AI Contract Summary:</strong> {fullContractReviewReport.contract_summary_by_ai || 'N/A'}
            </p>
            <p className="mt-2">
              <strong className="text-slate-700">Overall Shari'ah Alignment Notes:</strong> {fullContractReviewReport.overall_shariah_alignment_notes || 'N/A'}
            </p>
          </div>
        </details>
        {fullContractReviewReport.error && (
            <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                <AlertCircle size={16} className="inline mr-1" /> Error during review: {fullContractReviewReport.error}
            </p>
        )}
      </div>

      {/* Identified Issues and Recommendations */}
      {fullContractReviewReport.identified_clauses_with_issues && fullContractReviewReport.identified_clauses_with_issues.length > 0 && (
        <div className="mt-4 p-4 border border-slate-300 rounded-lg bg-white shadow">
          <h4 className="text-md font-semibold text-sky-700 mb-3">Detailed Findings & Recommendations:</h4>
          <div className="space-y-4">
            {fullContractReviewReport.identified_clauses_with_issues.map((issue, index) => {
              let severityColorClass = 'text-slate-600 bg-slate-100 border-slate-300'; // Default/Info
              if (issue.severity?.toLowerCase().includes('high')) severityColorClass = 'text-red-700 bg-red-100 border-red-400';
              else if (issue.severity?.toLowerCase().includes('medium')) severityColorClass = 'text-amber-700 bg-amber-100 border-amber-400';
              else if (issue.severity?.toLowerCase().includes('low')) severityColorClass = 'text-green-700 bg-green-100 border-green-400';

              return (
                <div key={index} className="p-3 border border-slate-200 rounded-md hover:shadow-md transition-shadow bg-slate-50">
                  <div className="mb-2">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${severityColorClass}`}>
                      Severity: {issue.severity || 'N/A'}
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-500 mb-1">Original Contract Snippet (Identified by AI):</p>
                  <blockquote className="text-xs italic border-l-2 border-slate-400 pl-3 my-1 bg-slate-100 p-2 rounded max-h-28 overflow-y-auto">
                    {issue.original_clause_text_snippet || "N/A"}
                  </blockquote>

                  <p className="text-sm mt-2">
                    <strong className="text-slate-700">Issue/Concern:</strong> {issue.issue_or_concern || 'N/A'}
                  </p>

                  {issue.relevant_shariah_rule_ids && issue.relevant_shariah_rule_ids.length > 0 && (
                    <p className="text-xs mt-1 text-slate-600">
                      <strong>Relevant Rule(s):</strong> {issue.relevant_shariah_rule_ids.join(', ')}
                    </p>
                  )}

                  <div className="mt-2">
                    <p className="text-sm font-medium text-emerald-700">AI Recommended Action/Modification:</p>
                    <pre className="text-xs bg-emerald-50 p-2 mt-1 rounded border border-emerald-200 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                      {issue.recommended_action_or_modification || 'N/A'}
                    </pre>
                     <button 
                        onClick={() => {
                            navigator.clipboard.writeText(issue.recommended_action_or_modification || '');
                            setApiMessage({type: 'success', text: 'Recommended modification copied to clipboard!'});
                        }}
                        className="text-xs mt-1 px-2 py-0.5 bg-sky-100 hover:bg-sky-200 text-sky-700 rounded"
                        disabled={!issue.recommended_action_or_modification}
                    >
                        Copy Recommendation
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {(!fullContractReviewReport.identified_clauses_with_issues || fullContractReviewReport.identified_clauses_with_issues.length === 0) && !fullContractReviewReport.error && (
        <div className="mt-4 p-4 border border-green-300 rounded-lg bg-green-50 text-green-700 text-sm shadow">
          <CheckCircle size={18} className="inline mr-2"/>
          AI review found no major issues or has only low-severity enhancement suggestions based on the provided rules and context. Please check general recommendations if any.
        </div>
      )}


      {/* General Recommendations */}
      {fullContractReviewReport.general_recommendations && fullContractReviewReport.general_recommendations.length > 0 && (
        <div className="mt-4 p-4 border border-slate-300 rounded-lg bg-white shadow">
          <h4 className="text-md font-semibold text-sky-700 mb-2">General Recommendations:</h4>
          <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 pl-2">
            {fullContractReviewReport.general_recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
    </section>
  );


  return (
    <div className="app-container flex flex-col lg:flex-row h-screen max-h-screen bg-slate-100 text-slate-800">
      <main className="main-content flex-grow p-4 sm:p-6 space-y-6 overflow-y-auto">
                <header className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl lg:text-3xl font-bold text-sky-700 flex items-center">
            <Settings size={30} className="mr-3 text-sky-600 rotate-[15deg]" /> ASAVE Interactive Suite
          </h1>
          {(isLoading || isProcessingContract) && (
            <button 
              onClick={() => {
                sseControllerRef.current?.abort();
                setIsLoading(false); setIsProcessingContract(false);
                setApiMessage({type: 'info', text: 'AI processing cancelled by user.'});
                setProgressLog(prev => [...prev, {event_type:"system_log", message: "⏹️ User cancelled AI processing.", step_code:"USER_CANCEL"}]);
              }}
              className="text-xs px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md shadow-sm"
            >
              Cancel AI
            </button>
          )}
        </header>
        {apiMessage && ( 
            <div className={`p-3 rounded-md text-sm ${apiMessage.type === 'error' ? 'bg-red-50 text-red-700 border-l-4 border-red-500' : apiMessage.type === 'success' ? 'bg-green-50 text-green-700 border-l-4 border-green-500' : apiMessage.type === 'warning' ? 'bg-yellow-50 text-yellow-700 border-l-4 border-yellow-500' : 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'} flex items-start`}>
                {apiMessage.type === 'error' && <AlertTriangle size={20} className="mr-2 flex-shrink-0"/>}
                {apiMessage.type === 'success' && <CheckCircle size={20} className="mr-2 flex-shrink-0"/>}
                {apiMessage.type === 'warning' && <AlertTriangle size={20} className="mr-2 flex-shrink-0"/>}
                {apiMessage.type === 'info' && <Info size={20} className="mr-2 flex-shrink-0"/>}
                <span>{apiMessage.text}</span>
            </div>
         )}

        {/* Top Level App View Toggle */}
        <div className="flex space-x-2 border-b border-slate-300 pb-3 mb-6">
            <button onClick={() => setCurrentAppView('fas_editor')} className={`px-4 py-2 text-sm font-medium rounded-md flex items-center ${currentAppView === 'fas_editor' ? 'bg-sky-600 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'}`}>
                <Edit3 size={16} className="mr-2"/> FAS Document Editor
            </button>
            <button onClick={() => setCurrentAppView('contract_suite')} className={`px-4 py-2 text-sm font-medium rounded-md flex items-center ${currentAppView === 'contract_suite' ? 'bg-teal-600 text-white shadow-md' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'}`}>
                <ShieldCheck size={16} className="mr-2"/> Shari'ah Contract Suite
            </button>
        </div>
        
        {/* Conditional Rendering of App Sections */}
        {currentAppView === 'fas_editor' && (
            <>
                <section className="bg-white p-5 rounded-lg shadow space-y-6">
                  <h2 className="text-lg font-semibold text-slate-700 flex items-center">
                    <Settings size={20} className="mr-2 text-sky-600"/>1. System Setup & Session Management
                  </h2>

                  {/* Tab-like interface for setup options */}
                  <div className="flex border-b border-slate-200 mb-4">
                    {/* These would be state-driven tabs if more complex */}
                    <button className="px-3 py-2 text-sm font-medium text-slate-600 border-b-2 border-transparent hover:border-sky-500 hover:text-sky-600 focus:outline-none focus:border-sky-700">
                      Initialize New/Default
                    </button>
                    {/* Add more buttons here for "Load Session" if you make it tabbed */}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Column 1: Initialize with Files (Upload + Library) */}
                    <div className="space-y-4 p-3 border border-slate-200 rounded-md">
                      <h3 className="text-md font-medium text-slate-600">Initialize with Files:</h3>
                      
                      <p className="text-xs text-slate-500">Select files from your computer or the server's PDF library.</p>
                      
                      <div>
                        <h4 className="text-sm font-semibold text-slate-500 mb-1">Upload Files:</h4>
                        <FileUploader label="FAS PDF(s) Upload" accept=".pdf" multiple={true} onFilesUploaded={setFasFilesForInit} id="fas-init-upload" />
                        <FileUploader label="SS PDF(s) Upload" accept=".pdf" multiple={true} onFilesUploaded={setSsFilesForInit} id="ss-init-upload"/>
                        <FileUploader label="Explicit Rules JSON Upload (Optional)" accept=".json" onFilesUploaded={(file) => setRulesFileForInit(file as File)} id="rules-init-upload" />
                      </div>

                      {libraryPdfs.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-500 mb-1">Or Select from Server Library:</h4>
                          <div className="max-h-40 overflow-y-auto border p-2 rounded-md text-xs">
                            <p className="font-medium mb-1">FAS Files from Library:</p>
{libraryPdfs.filter(item => {
    if (item.type === 'file') {
        // Better file pattern matching for FAS files
        return item.name.toLowerCase().includes('fas') || 
               /f[a-z]*_?a[a-z]*_?s[a-z]*/i.test(item.name) ||
               item.name.toLowerCase().includes('financial_accounting_standard');
    } else if (item.type === 'directory') {
        // For directories
        return item.name.toLowerCase().includes('fas') || 
               item.name.toLowerCase().includes('financial') || 
               item.name.toLowerCase().includes('accounting');
    }
    return false;
}).map(item => (
    item.type === 'file' ? 
    <div key={item.name} className="flex items-center space-x-1">
        <input 
            type="checkbox" 
            id={`fas-${item.name}`}
            value={item.name} 
            onChange={(e) => {
                const name = e.target.value;
                setSelectedLibraryFas(prev => 
                    e.target.checked ? [...prev, name] : prev.filter(n => n !== name)
                );
            }} 
            className="text-sky-600 focus:ring-sky-500"
        />
        <label htmlFor={`fas-${item.name}`} className="text-xs truncate">{item.name}</label>
    </div>
    : <div key={item.name} className="ml-2">
        <p className="text-xs font-medium text-slate-700 mt-1">{item.name}/</p>
        <div className="pl-3">
        {item.files?.map(f => 
            <div key={f} className="flex items-center space-x-1">
                <input 
                    type="checkbox" 
                    id={`fas-${item.name}-${f}`}
                    value={`${item.name}/${f}`} 
                    onChange={(e) => {
                        const path = e.target.value;
                        setSelectedLibraryFas(prev => 
                            e.target.checked ? [...prev, path] : prev.filter(n => n !== path)
                        );
                    }}
                    className="text-sky-600 focus:ring-sky-500" 
                />
                <label htmlFor={`fas-${item.name}-${f}`} className="text-xs truncate">{f}</label>
            </div>
        )}
        </div>
    </div>
))}

<p className="font-medium mt-3 mb-1">SS Files from Library:</p>
{libraryPdfs.filter(item => {
    if (item.type === 'file') {
        // Better file pattern matching for SS files
        return item.name.toLowerCase().includes('ss') || 
               item.name.toLowerCase().includes('shariah') || 
               item.name.toLowerCase().includes('shari\'ah') || 
               item.name.toLowerCase().includes('sharia') || 
               /s[a-z]*_?s[a-z]*/i.test(item.name);
    } else if (item.type === 'directory') {
        // For directories
        return item.name.toLowerCase().includes('ss') || 
               item.name.toLowerCase().includes('shariah') || 
               item.name.toLowerCase().includes('shari\'ah') || 
               item.name.toLowerCase().includes('sharia') || 
               item.name.toLowerCase().includes('standard');
    }
    return false;
}).map(item => (
    item.type === 'file' ? 
    <div key={item.name} className="flex items-center space-x-1">
        <input 
            type="checkbox" 
            id={`ss-${item.name}`}
            value={item.name} 
            onChange={(e) => {
                const name = e.target.value;
                setSelectedLibrarySs(prev => 
                    e.target.checked ? [...prev, name] : prev.filter(n => n !== name)
                );
            }}
            className="text-teal-600 focus:ring-teal-500" 
        />
        <label htmlFor={`ss-${item.name}`} className="text-xs truncate">{item.name}</label>
    </div>
    : <div key={item.name} className="ml-2">
        <p className="text-xs font-medium text-slate-700 mt-1">{item.name}/</p>
        <div className="pl-3">
        {item.files?.map(f => 
            <div key={f} className="flex items-center space-x-1">
                <input 
                    type="checkbox" 
                    id={`ss-${item.name}-${f}`}
                    value={`${item.name}/${f}`} 
                    onChange={(e) => {
                        const path = e.target.value;
                        setSelectedLibrarySs(prev => 
                            e.target.checked ? [...prev, path] : prev.filter(n => n !== path)
                        );
                    }}
                    className="text-teal-600 focus:ring-teal-500" 
                />
                <label htmlFor={`ss-${item.name}-${f}`} className="text-xs truncate">{f}</label>
            </div>
        )}
        </div>
    </div>
))}
                          </div>
                        </div>
                      )}
                      <div className="mt-3">
                        <label htmlFor="newSessionName" className="block text-xs font-medium text-slate-700">Save this configuration as session (Optional):</label>
                        <input 
                            type="text" id="newSessionName" value={newSessionName} 
                            onChange={(e) => setNewSessionName(e.target.value)} 
                            placeholder="e.g., MyFAS_Project_Q1"
                            className="mt-1 input-field text-xs"
                        />
                        {newSessionName && <label className="text-xs flex items-center mt-1"><input type="checkbox" checked={overwriteSession} onChange={(e) => setOverwriteSession(e.target.checked)} className="mr-1"/> Overwrite if exists</label>}
                      </div>
                    </div>

                    {/* Column 2: Load Existing Session */}
                    <div className="space-y-4 p-3 border border-slate-200 rounded-md">
                      <h3 className="text-md font-medium text-slate-600">Or Load Existing Session:</h3>
                      {availableSessions.length > 0 ? (
                        <div className="space-y-2">
                          <select 
                            value={selectedSessionToLoad} 
                            onChange={(e) => {
                                setSelectedSessionToLoad(e.target.value);
                                if(e.target.value) { // If a session is chosen to load, clear new session name
                                    setNewSessionName('');
                                    // Clear file selections as we are loading, not creating with these files
                                    setSelectedLibraryFas([]);
                                    setSelectedLibrarySs([]);
                                    // Potentially clear uploaded file states too (setFasFilesForInit(null), etc.)
                                }
                            }}
                            className="input-field text-sm"
                          >
                            <option value="">-- Select a session to load --</option>
                            {availableSessions.map(session => (
                              <option key={session.session_id} value={session.session_id}>
                                {session.session_id} (FAS: {session.has_fas_db ? '✓':'✗'}, SS: {session.has_ss_db ? '✓':'✗'}, Mod: {session.last_modified})
                              </option>
                            ))}
                          </select>
                          {selectedSessionToLoad && <p className="text-xs text-sky-600">Loading session '{selectedSessionToLoad}' will use its stored vector databases.</p>}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No saved sessions found. Initialize one first.</p>
                      )}
                      <button onClick={fetchSessions} className="btn-secondary-small text-xs mt-2">Refresh Session List</button>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleInitializeModified} 
                    disabled={isLoading} 
                    className="w-full btn-primary mt-4 py-2.5"
                  >
                    {isLoading && apiMessage?.text.includes('Processing initialization') ? <Loader2 className="inline mr-2 h-5 w-5 animate-spin"/> : '🚀 '}
                    {selectedSessionToLoad ? `Load Session: ${selectedSessionToLoad}` : 'Initialize / Save Session'}
                  </button>
                  {currentSessionId && <p className="text-xs text-green-700 bg-green-100 p-2 rounded mt-2">✅ Active Session: <strong>{currentSessionId}</strong></p>}
                </section>
                 {isSystemInitialized && renderFasEditor()} 
                 {!isSystemInitialized && 
                    <div className="p-6 bg-yellow-50 text-yellow-700 rounded-md border border-yellow-300 text-center shadow">
                      <Info size={24} className="mx-auto mb-2"/>
                      <p className="font-medium">The ASAVE system backend needs to be initialized first.</p>
                      <p className="text-sm">Please go to "System Setup" and initialize with FAS/SS files or load a session to activate the AI features.</p>
                    </div>
                 }
            </>
        )}

        {currentAppView === 'contract_suite' && renderContractSuite()}
      
      </main>

      <Sidebar
        progressLog={progressLog}
        suggestions={currentAppView === 'fas_editor' ? finalSuggestionsForFAS : []} // Sidebar suggestions for FAS editor
        onAcceptSuggestion={handleAcceptSuggestion}
        onRejectSuggestion={handleRejectSuggestion  }
        isLoading={isLoading || isProcessingContract}
        className="w-full md:w-[450px] md:min-w-[400px] lg:w-[500px] lg:min-w-[450px] h-screen md:max-h-screen overflow-y-auto"
      />
    </div>
  );
};

export default App;