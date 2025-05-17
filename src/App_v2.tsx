/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/App.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import FileUploader from './components/FileUploader';
import SuggestionCard from './components/SuggestionCard';
import {
    // initializeSystem, // We'll use a more specific handler for init
    getAssistanceStreamUrl,
    getApiStatus,
    type InitResponse,
    type SSEEventData,
    type ValidatedSuggestionPackage,
    analyzeContextualUpdate // New import for CUA
} from './services/api';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Upload, Settings, AlertTriangle, CheckCircle, Info, MessageSquare, Edit3, Loader2, Eye, Edit, ShieldCheck, ListChecks, FileSignature, FileSearch2, User, Bot, Paperclip, Send, Copy, X, SlidersHorizontal, Database, FolderOpenDot, MessageCircleQuestion, PlusCircle, ChevronsLeft, ChevronsRight, BookOpen, FileText, Save, History, Code, BrainCircuit, Search, Percent, Lightbulb
} from 'lucide-react';

// --- Type Definitions ---
interface FallbackExtractedPdfResponse { status: string; pages?: Array<{ page_number: number; content: string }>; message?: string; document_info?: any; [key: string]: any; }
interface MarkerApiResponse { status: string; extracted_text?: string; message?: string; document_info?: any; [key: string]: any; }
interface ClientClauseInput { clause_id: string; text: string; }
interface ClauseValidationPayload { clause_id: string; original_text: string; scva_report: any; }
interface ClauseAiSuggestionPayload extends ValidatedSuggestionPackage { clause_id: string; } // Assumes ValidatedSuggestionPackage will include confidence in suggestion_details
interface LibraryPdfItem { name: string; type: "file" | "directory"; path?: string; files?: string[]; }
interface SessionInfo { session_id: string; path: string; has_fas_db: boolean; has_ss_db: boolean; last_modified: string; }
interface FullContractReviewReport { overall_assessment: string; contract_summary_by_ai: string; identified_clauses_with_issues: Array<{ original_clause_text_snippet: string; issue_or_concern: string; relevant_shariah_rule_ids?: string[]; recommended_action_or_modification: string; severity: "High - Clear Non-Compliance" | "Medium - Potential Risk/Ambiguity" | "Low - Suggestion for Enhancement" | "Information" | string; }>; general_recommendations?: string[]; overall_shariah_alignment_notes: string; error?: string; }
interface ClauseAnalysisResult { clause_id: string; original_text: string; validation_status?: string; validation_reason?: string; scva_report_original_clause?: any; ai_suggestions: ValidatedSuggestionPackage[]; processing_message?: string; skipped?: boolean; skipped_reason?: string; }

// Chat Message Type
type MessageSender = 'user' | 'ai' | 'system';
interface ChatMessage { id: string; sender: MessageSender; text?: string; component?: React.ReactNode; timestamp: Date; sseEvent?: SSEEventData; isLoading?: boolean; }

// Modal Types
type ModalType = null | 'init_system' | 'contract_clause_input' | 'contract_full_input' | 'contextual_update_input';

// Page View Types
type PageView = 'chat' | 'fas_editor_page';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const sampleSalamContractForHelper = { /* ... same sample contract ... */ 
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

// --- Main App Component ---
const App: React.FC = () => {
  // --- UI & Navigation State ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [currentPageView, setCurrentPageView] = useState<PageView>('chat');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(true);
  const [minConfidenceForHighlight, setMinConfidenceForHighlight] = useState<number>(75); // Default threshold

  // --- Initialization State ---
  const [isSystemInitialized, setIsSystemInitialized] = useState<boolean>(false);
  const [libraryPdfs, setLibraryPdfs] = useState<LibraryPdfItem[]>([]);
  const [availableSessions, setAvailableSessions] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [fasFilesForInitModal, setFasFilesForInitModal] = useState<FileList | null>(null);
  const [ssFilesForInitModal, setSsFilesForInitModal] = useState<FileList | null>(null);
  const [rulesFileForInitModal, setRulesFileForInitModal] = useState<File | null>(null);
  const [selectedLibraryFasModal, setSelectedLibraryFasModal] = useState<string[]>([]);
  const [selectedLibrarySsModal, setSelectedLibrarySsModal] = useState<string[]>([]);
  const [selectedSessionToLoadModal, setSelectedSessionToLoadModal] = useState<string>('');
  const [newSessionNameModal, setNewSessionNameModal] = useState<string>('');
  const [overwriteSessionModal, setOverwriteSessionModal] = useState<boolean>(false);

  // --- FAS Document State ---
  const [fasEditorInitialContent, setFasEditorInitialContent] = useState<string>('');
  const [fasEditorDocumentId, setFasEditorDocumentId] = useState<string>('');
  const [fasEditorSuggestions, setFasEditorSuggestions] = useState<ValidatedSuggestionPackage[]>([]);
  const [isFasSuggestionsLoading, setIsFasSuggestionsLoading] = useState<boolean>(false);
  const [suggestionToApplyToEditor, setSuggestionToApplyToEditor] = useState<ValidatedSuggestionPackage | null>(null);

  // --- Contract Helper State ---
  const [contractHelperMode, setContractHelperMode] = useState<'full_contract' | 'clause_by_clause'>('clause_by_clause');
  const [contractType, setContractType] = useState<string>(sampleSalamContractForHelper.contract_type);
  const [clientClausesInput, setClientClausesInput] = useState<string>(sampleSalamContractForHelper.client_clauses_text);
  const [fullContractTextInput, setFullContractTextInput] = useState<string>('');
  const [overallContractCtx, setOverallContractCtx] = useState<string>(sampleSalamContractForHelper.overall_contract_context);
  const [clauseAnalysisResults, setClauseAnalysisResults] = useState<ClauseAnalysisResult[]>([]);
  const [fullContractReviewReport, setFullContractReviewReport] = useState<FullContractReviewReport | null>(null);
  const [contractSuggestionsForChat, setContractSuggestionsForChat] = useState<ValidatedSuggestionPackage[]>([]);


  // --- Contextual Update Agent State ---
  const [contextualUpdateTextModal, setContextualUpdateTextModal] = useState("");
  const [targetFasForUpdateModal, setTargetFasForUpdateModal] = useState("");
  const [knownFasDocumentIds, setKnownFasDocumentIds] = useState<string[]>([]); // To populate dropdown for CUA

  // --- API Interaction State ---
  const [isLoading, setIsLoading] = useState<boolean>(false); 
  const [isProcessingContract, setIsProcessingContract] = useState<boolean>(false);
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const sseControllerRef = useRef<AbortController | null>(null);
  const [currentSseMessageId, setCurrentSseMessageId] = useState<string | null>(null);

  // --- Chat Utility Functions ---
  const addMessage = (sender: MessageSender, text?: string, component?: React.ReactNode, isLoadingPlaceholder: boolean = false): string => { /* ... same ... */ 
    const newMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setChatMessages(prev => [...prev, { id: newMessageId, sender, text, component, timestamp: new Date(), isLoading: isLoadingPlaceholder }]);
    return newMessageId;
  };
  const updateMessage = (messageId: string, newText?: string, newComponent?: React.ReactNode, stopLoading: boolean = false) => { /* ... same ... */ 
     setChatMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, text: newText !== undefined ? newText : msg.text, component: newComponent !== undefined ? newComponent : msg.component, isLoading: stopLoading ? false : msg.isLoading } : msg ));
  };

  const appendToMessage = (messageId: string, textChunk: string, isSseEvent?: SSEEventData) => {
    setChatMessages(prev => prev.map(msg => {
      if (msg.id === messageId) {
        let newText = (msg.text || "") + textChunk;
        let newComponent = msg.component;

        if (isSseEvent && isSseEvent.event_type === "clause_ai_suggestion_generated" && isSseEvent.payload) {
            const suggestionPayload = isSseEvent.payload as ClauseAiSuggestionPayload;
            setContractSuggestionsForChat(prevSugg => [...prevSugg, suggestionPayload]); // Add to list for highlighting logic
            // Component rendering for chat will be handled by a separate mapping over contractSuggestionsForChat
            newText += `\nℹ️ AI Suggestion from ${suggestionPayload.source_agent_name} (Confidence: ${suggestionPayload.suggestion_details.confidence_score || 'N/A'}%) received. It will appear below or in a dedicated section.`;
        } else if (isSseEvent && isSseEvent.event_type === "full_contract_review_completed" && isSseEvent.payload) {
            newText = ""; newComponent = renderFullContractReviewReportChat(isSseEvent.payload as FullContractReviewReport);
        } else if (isSseEvent && isSseEvent.message && textChunk.includes(isSseEvent.message)) {
            // Simple progress, text already part of textChunk
        }
        return { ...msg, text: newText, component: newComponent, isLoading: false, sseEvent: isSseEvent ?? msg.sseEvent };
      }
      return msg;
    }));
  };
  useEffect(() => { chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight); }, [chatMessages]);

  // --- Initial Load ---
  useEffect(() => { /* ... same ... */ 
    addMessage('ai', "👋 Welcome to ASAVE Interactive Suite! Use the sidebars to get started or type 'help'.");
    getApiStatus().then(statusData => {
      if (statusData?.asave_initialized) {
        setIsSystemInitialized(true);
        if(statusData.current_session_id) setCurrentSessionId(statusData.current_session_id);
      }
    }).catch(error => addMessage('system', `Error: Could not connect to ASAVE API. (${(error as Error).message})`));
    fetchLibraryPdfsInternal();
    fetchSessionsInternal();
  }, []);
  
  // Update knownFasDocumentIds when fasEditorDocumentId changes (e.g., after loading a new doc)
  useEffect(() => {
    if (fasEditorDocumentId && !knownFasDocumentIds.includes(fasEditorDocumentId)) {
      setKnownFasDocumentIds(prev => [...prev, fasEditorDocumentId]);
    }
  }, [fasEditorDocumentId, knownFasDocumentIds]);


  // --- API Call Functions ---
  const fetchLibraryPdfsInternal = async () => { /* ... same ... */ 
    try { const response = await axios.get(`${API_BASE_URL}/list_library_pdfs`); if (response.data.status === 'success') setLibraryPdfs(response.data.pdf_files); else addMessage('system', `Error fetching library PDFs: ${response.data.message}`); } catch (error: any) { addMessage('system', `Error fetching library PDFs: ${error.message}`); }
  };
  const fetchSessionsInternal = async () => { /* ... same ... */ 
    try { const response = await axios.get(`${API_BASE_URL}/list_sessions`); if (response.data.status === 'success') setAvailableSessions(response.data.sessions); else addMessage('system', `Error fetching sessions: ${response.data.message}`); } catch (error: any) { addMessage('system', `Error fetching sessions: ${error.message}`); }
  };

  const handleInitializeBackend = async () => { /* Uses modal states like fasFilesForInitModal */ 
    if (!selectedSessionToLoadModal && !fasFilesForInitModal && !ssFilesForInitModal && selectedLibraryFasModal.length === 0 && selectedLibrarySsModal.length === 0) { addMessage('ai', "To initialize, please select files to process or a session to load via the 'System Setup' modal."); return; }
    setIsLoading(true); const initMsgId = addMessage('ai', 'Initializing backend...', undefined, true);
    const formData = new FormData();
    if (selectedSessionToLoadModal) formData.append('load_session_id', selectedSessionToLoadModal);
    else {
      if (newSessionNameModal) { formData.append('save_as_session_name', newSessionNameModal); if (overwriteSessionModal) formData.append('overwrite_session', 'true'); }
      if (fasFilesForInitModal) Array.from(fasFilesForInitModal).forEach(f => formData.append('fas_files_upload', f, f.name));
      if (ssFilesForInitModal) Array.from(ssFilesForInitModal).forEach(f => formData.append('ss_files_upload', f, f.name));
      if (rulesFileForInitModal) formData.append('shariah_rules_explicit_file_upload', rulesFileForInitModal, rulesFileForInitModal.name);
      if (selectedLibraryFasModal?.length) formData.append('library_fas_filenames', JSON.stringify(selectedLibraryFasModal));
      if (selectedLibrarySsModal?.length) formData.append('library_ss_filenames', JSON.stringify(selectedLibrarySsModal));
    }
    try {
      const response = await axios.post<InitResponse>(`${API_BASE_URL}/initialize`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      const data = response.data; updateMessage(initMsgId, `Backend Init ${data.status}: ${data.message}`, undefined, true);
      if (data.status === 'success') { setIsSystemInitialized(true); setCurrentSessionId(data.session_id || null); addMessage('ai', `System initialized. Session: ${data.session_id || 'default'}.`); fetchSessionsInternal(); if (newSessionNameModal && !selectedSessionToLoadModal) setNewSessionNameModal(''); } 
      else { setIsSystemInitialized(false); setCurrentSessionId(null); }
    } catch (error: any) { updateMessage(initMsgId, `Initialization failed: ${error.response?.data?.message || error.message}`, undefined, true); setIsSystemInitialized(false); setCurrentSessionId(null); }
    setIsLoading(false); setActiveModal(null);
    setFasFilesForInitModal(null); setSsFilesForInitModal(null); setRulesFileForInitModal(null); setSelectedLibraryFasModal([]); setSelectedLibrarySsModal([]); setSelectedSessionToLoadModal(''); setOverwriteSessionModal(false);
  };

  const handleLoadSession = (sessionId: string) => { /* ... same, sets modal states ... */ 
    addMessage('user', `Load session: ${sessionId}`); setSelectedSessionToLoadModal(sessionId); setNewSessionNameModal(''); setActiveModal('init_system');
  };
  const handleCreateNewSessionFromSidebar = () => { /* ... same, clears modal states ... */ 
    setSelectedSessionToLoadModal(''); setNewSessionNameModal(''); setFasFilesForInitModal(null); setSsFilesForInitModal(null); setRulesFileForInitModal(null); setSelectedLibraryFasModal([]); setSelectedLibrarySsModal([]); setActiveModal('init_system');
  };
  const handleFasFileForEditor = async (file: File | null) => { /* ... same, but updates knownFasDocumentIds ... */ 
    if (!file) { addMessage('ai', "No FAS file selected."); return; }
    setIsExtractingText(true); const processingMsgId = addMessage('ai', `Extracting text from ${file.name}...`, undefined, true);
    const formData = new FormData(); formData.append('pdf_file', file);
    try {
      let markdownText = ''; let docInfo: any = { filename: file.name };
      try {
        const markerResponse = await axios.post<MarkerApiResponse>(`${API_BASE_URL}/extract_text_from_pdf_file_marker`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        if (markerResponse.data.status === 'success' && typeof markerResponse.data.extracted_text === 'string') { markdownText = markerResponse.data.extracted_text; docInfo = markerResponse.data.document_info || { filename: file.name, ...markerResponse.data };} 
        else { throw new Error(markerResponse.data.message || "Marker extraction failed"); }
      } catch (markerError) {
        updateMessage(processingMsgId, `Marker failed. Trying fallback for ${file.name}...`);
        const fallbackResponse = await axios.post<FallbackExtractedPdfResponse>(`${API_BASE_URL}/extract_text_from_pdf?reformat_ai=true`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        if (fallbackResponse.data.status === 'success' && fallbackResponse.data.pages?.length) { markdownText = fallbackResponse.data.pages.map(p => `<!-- Page ${p.page_number} -->\n${p.content.trim()}`).join('\n\n<hr />\n\n'); docInfo = fallbackResponse.data.document_info || { filename: file.name, ...fallbackResponse.data };} 
        else { throw new Error(fallbackResponse.data.message || "Fallback extraction failed"); }
      }
      const finalDocumentId = (docInfo && docInfo.filename) ? docInfo.filename : file.name;
      if (!finalDocumentId || finalDocumentId.trim() === "") { updateMessage(processingMsgId, `PDF Processing Error: Could not determine document ID for ${file.name}.`, undefined, true); setIsExtractingText(false); return; }
      updateMessage(processingMsgId, `Extraction complete for ${finalDocumentId}. Navigating to editor...`, undefined, true);
      setFasEditorInitialContent(markdownText.trimStart()); setFasEditorDocumentId(finalDocumentId);
      if (finalDocumentId && !knownFasDocumentIds.includes(finalDocumentId)) setKnownFasDocumentIds(prev => [...prev, finalDocumentId]); // Add to known docs for CUA
      setCurrentPageView('fas_editor_page');
    } catch (e: any) { updateMessage(processingMsgId, `PDF Processing Failed for FAS Editor: ${e.message}`, undefined, true); }
    setIsExtractingText(false);
  };

  // --- SSE Processing ---
  const startSSEProcessing = useCallback( /* ... same as before ... */ 
    async ( url: string, payload: any, onEvent: (eventData: SSEEventData, sseMessageId: string) => void, onComplete: (sseMessageId: string) => void, onError: (error: Error, sseMessageId: string) => void, onFinally?: (sseMessageId: string) => void, isSilent: boolean = false ) => {
    let sseMessageId = ''; if (!isSilent) { sseMessageId = addMessage('ai', "🤖 AI processing requested...", undefined, true); setCurrentSseMessageId(sseMessageId); appendToMessage(sseMessageId, "Thinking...🧠\n\n---\n"); }
    if (sseControllerRef.current) sseControllerRef.current.abort(); const controller = new AbortController(); sseControllerRef.current = controller;
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) { const et = await response.text(); throw new Error(`API Error: ${response.status} - ${et}`); }
      if (!response.body) throw new Error("No response body from API.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let sseBuffer = '';
      async function processStream() { while (true) { try { const { done, value } = await reader.read(); if (controller.signal.aborted) { if (!isSilent && sseMessageId) appendToMessage(sseMessageId, "\n--- \n⏹️ AI processing cancelled by user."); break; } if (done) { onComplete(sseMessageId); break; } sseBuffer += decoder.decode(value, { stream: true }); const messages = sseBuffer.split('\n\n'); sseBuffer = messages.pop() || ''; messages.forEach(message => { if (message.startsWith('data: ')) { try { const eventData = JSON.parse(message.substring(6)) as SSEEventData; onEvent(eventData, sseMessageId); } catch (e) { console.warn("SSE JSON Parse Error:", e, "Raw:", message); if(!isSilent && sseMessageId) appendToMessage(sseMessageId, `\n⚠️ Error parsing AI stream data.`); } } }); } catch (streamReadError: any) { onError(streamReadError, sseMessageId); break; } } } await processStream();
    } catch (error: any) { onError(error, sseMessageId); }
    finally { if (onFinally) onFinally(sseMessageId); if (sseMessageId === currentSseMessageId) setCurrentSseMessageId(null); if (sseControllerRef.current === controller) sseControllerRef.current = null; }
  }, [currentSseMessageId]);

  const handleGetAIAssistanceForFASFromEditor = (selectedText: string, documentId: string, markdownContent: string) => { /* ... same, but sets fasEditorSuggestions and isFasSuggestionsLoading ... */ 
    if (!selectedText.trim()) { sendSystemNotification("Please select text in the FAS editor to get suggestions.", "info"); return; }
    if (!isSystemInitialized && markdownContent) { sendSystemNotification("Warning: Backend KB not initialized. AI suggestions might be limited.", "info"); }
    else if (!isSystemInitialized && !markdownContent) { sendSystemNotification("Error: Please initialize the backend and load/process a FAS document first.", "error"); return; }
    setFasEditorSuggestions([]); setIsFasSuggestionsLoading(true);
    const payload = { selected_text_from_fas: selectedText, fas_document_id: documentId };
    startSSEProcessing( getAssistanceStreamUrl(), payload,
      (eventData, _sseMsgId) => {
        if (eventData.event_type === "validated_suggestion_package" && eventData.payload) { setFasEditorSuggestions(prev => [...prev, eventData.payload as ValidatedSuggestionPackage]); }
        if (eventData.event_type === "fatal_error") { sendSystemNotification(`FAS AI Error (Editor): ${eventData.message}`, "error"); setIsFasSuggestionsLoading(false); sseControllerRef.current?.abort(); }
      },
      (_sseMsgId) => { setIsFasSuggestionsLoading(false); sendSystemNotification("FAS AI analysis complete for editor.", "success"); },
      (error, _sseMsgId) => { setIsFasSuggestionsLoading(false); if (error.name !== 'AbortError') sendSystemNotification(`FAS AI Assist Failed (Editor): ${error.message}`, "error"); else sendSystemNotification("FAS AI assistance cancelled (Editor).", "info"); },
      undefined, true // isSilent = true
    );
  };
  
  const handleAcceptFasEditorSuggestion = (suggestionToAccept: ValidatedSuggestionPackage) => { /* ... same ... */ 
    setSuggestionToApplyToEditor(suggestionToAccept); setFasEditorSuggestions(prev => prev.filter(s => s !== suggestionToAccept)); 
  };
  const handleRejectFasEditorSuggestion = (suggestionToReject: ValidatedSuggestionPackage) => { /* ... same ... */ 
    setFasEditorSuggestions(prev => prev.filter(s => s !== suggestionToReject)); sendSystemNotification(`Suggestion from ${suggestionToReject.source_agent_name} rejected for FAS editor.`, "info");
  };
  const handleFasSuggestionAppliedOrDismissedInEditor = () => { /* ... same ... */ 
    setSuggestionToApplyToEditor(null); 
  };

  const handleValidateContractTerms = () => { /* ... main logic same, but now uses setContractSuggestionsForChat ... */ 
    if (!isSystemInitialized) { addMessage('ai', "Error: Please initialize the backend system first."); return; }
    // ... (payload prep) ...
    setActiveModal(null); setClauseAnalysisResults([]); setFullContractReviewReport(null); setContractSuggestionsForChat([]); // Clear contract suggestions
    setIsProcessingContract(true);
    const endpoint = contractHelperMode === 'clause_by_clause' ? `${API_BASE_URL}/validate_contract_terms_stream` : `${API_BASE_URL}/review_full_contract_stream`;
    const payload = contractHelperMode === 'clause_by_clause' ? { contract_type: contractType, client_clauses: clientClausesInput.split('\n').map((t,i)=>({clause_id:`c${i}`, text:t})).filter(c=>c.text.trim()), overall_contract_context: overallContractCtx } : { full_contract_text: fullContractTextInput, contract_type: contractType };
    startSSEProcessing( endpoint, payload,
      (eventData, sseMsgId) => { 
        if (eventData.message) appendToMessage(sseMsgId, `\n${eventData.agent_name || 'ContractAI'}: ${eventData.message}`);
        if (contractHelperMode === 'clause_by_clause') {
            if (eventData.event_type === "clause_validation_result" && eventData.payload) { const data = eventData.payload as ClauseValidationPayload; appendToMessage(sseMsgId, `\n📋 Clause '${data.clause_id}': ${data.scva_report?.overall_status} - ${data.scva_report?.summary_explanation || 'Validated.'}`); } 
            else if (eventData.event_type === "clause_ai_suggestion_generated" && eventData.payload) {
                 setContractSuggestionsForChat(prev => [...prev, eventData.payload as ClauseAiSuggestionPayload]); // Add to list
                 // A small note in chat, actual card rendered via mapping contractSuggestionsForChat
                 appendToMessage(sseMsgId, `\n💡 Suggestion for clause '${(eventData.payload as ClauseAiSuggestionPayload).clause_id}' received (Confidence: ${ (eventData.payload as ClauseAiSuggestionPayload).suggestion_details.confidence_score || 'N/A'}%).`);
            }
        } else { if (eventData.event_type === "full_contract_review_completed" && eventData.payload) { appendToMessage(sseMsgId, "", eventData); } }
        if (eventData.event_type === "fatal_error") { appendToMessage(sseMsgId, `\n❌ Fatal Error: ${eventData.message}`); sseControllerRef.current?.abort(); }
      },
      (sseMsgId) => { appendToMessage(sseMsgId, "\n\n---\n✅ Contract review process finished!"); setIsProcessingContract(false); },
      (error, sseMsgId) => { if (error.name !== 'AbortError') appendToMessage(sseMsgId, `\n❌ Contract Review Failed: ${error.message}`); else appendToMessage(sseMsgId, "\n⏹️ Contract review cancelled."); setIsProcessingContract(false); },
      () => setIsProcessingContract(false)
    );
  };
  
  const sendSystemNotification = (message: string, type: 'info' | 'error' | 'success' = 'info') => { addMessage('system', `🔔 ${type.toUpperCase()}: ${message}`); };
  const onFasDocumentSaveFromEditor = (docId: string, _newContent: string, summary: string) => { sendSystemNotification(`Version of '${docId}' saved via editor. Summary: "${summary}"`, "success"); };

  // --- Chat Input Handler ---
  const handleUserChatInput = () => { /* ... same ... */ 
    const trimmedInput = userInput.trim().toLowerCase(); if (!trimmedInput) return; addMessage('user', userInput); setUserInput('');
    if (trimmedInput === 'help') { addMessage('ai', undefined, <div className="space-y-1 text-sm"> <p>Common actions are in sidebars. You can also type:</p> <ul className="list-disc list-inside"> <li>'<strong>new session</strong>'</li> <li>'<strong>list library</strong>'</li> <li>'<strong>contextual update</strong>' or '<strong>analyze context</strong>'</li></ul> </div> ); } 
    else if (trimmedInput === 'new session' || trimmedInput === 'create session') { handleCreateNewSessionFromSidebar(); } 
    else if (trimmedInput === 'list library') { /* ... same ... */ }
    else if (trimmedInput === 'contextual update' || trimmedInput === 'analyze context') { setActiveModal('contextual_update_input'); setContextualUpdateTextModal(''); if(knownFasDocumentIds.length > 0) setTargetFasForUpdateModal(knownFasDocumentIds[0]); else setTargetFasForUpdateModal(''); }
    else { addMessage('ai', `I received: "${trimmedInput}". For specific actions, please use controls or 'help'.`); }
  };

  // --- Contextual Update Agent Handler ---
  const handleProcessContextualUpdate = async () => {
    if (!contextualUpdateTextModal.trim() || !targetFasForUpdateModal.trim()) {
        addMessage('ai', "Please provide both the new contextual text and select a target FAS document in the modal."); return;
    }
    setActiveModal(null);
    addMessage('user', `Analyze impact of new context on FAS: ${targetFasForUpdateModal}`);
    const analysisMsgId = addMessage('ai', `Analyzing impact on ${targetFasForUpdateModal}...`, undefined, true);
    setIsLoading(true);
    try {
        const response = await analyzeContextualUpdate({ new_context_text: contextualUpdateTextModal, target_document_id: targetFasForUpdateModal });
        if (response.status === 'success') { updateMessage(analysisMsgId, undefined, renderCuaAnalysisChat(response.analysis), true); } 
        else { updateMessage(analysisMsgId, `Error analyzing context: ${response.message || 'Unknown error'}`, undefined, true); }
    } catch (error: any) { updateMessage(analysisMsgId, `Failed to analyze context: ${error.response?.data?.message || error.message}`, undefined, true); }
    finally { setIsLoading(false); }
  };

  // Render helpers for CUA analysis and Contract suggestions in chat
  const renderCuaAnalysisChat = (analysis: any) => { /* ... same as before, for chat ... */ 
    if (!analysis || analysis.error) return <p className="text-red-500">Error in CUA Analysis: {analysis?.error || "Unknown error"}</p>;
    return ( <div className="text-xs space-y-1 p-2 bg-indigo-50 border border-indigo-200 rounded max-h-80 overflow-y-auto scrollbar-thin"> <h5 className="font-semibold text-indigo-700 text-sm">Contextual Update Analysis</h5> <p><strong>Overall Assessment:</strong> {analysis.overall_assessment}</p> {/* ... rest of CUA display ... */} </div> );
  };
  const renderFullContractReviewReportChat = (report: FullContractReviewReport | null) => { /* ... same as before ... */ 
     if (!report) return <p>No full contract review report.</p>; if (report.error) return <p className="text-red-500">Error: {report.error}</p>; return ( <div className="mt-2 space-y-2 p-2 bg-slate-100 rounded border text-xs"> <h4 className="text-sm font-semibold text-sky-700">Full Contract Review</h4> {/* ... rest of report display ... */} </div> );
  };
  
  // Memoized calculation for highlighted contract suggestion
  const highlightedContractSuggestionId = useMemo(() => {
    if (!contractSuggestionsForChat.length) return null;
    let highestConfidence = -1;
    let bestSuggestionId: string | null = null; // Assuming suggestions have a unique ID or we use index
    contractSuggestionsForChat.forEach((sugg, index) => {
        const score = sugg.suggestion_details.confidence_score ?? 0;
        if (score >= minConfidenceForHighlight && score > highestConfidence) {
            highestConfidence = score;
            bestSuggestionId = `${sugg.source_agent_name}-${sugg.clause_id}-${index}`; // Create a pseudo-ID
        }
    });
    return bestSuggestionId;
  }, [contractSuggestionsForChat, minConfidenceForHighlight]);


  // --- Main Render ---
  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 overflow-hidden">
      <header className="p-3 bg-sky-700 text-white flex justify-between items-center shadow-md shrink-0"> {/* ... same header ... */ }
        <div className="flex items-center"> <button onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} className="mr-2 p-1.5 hover:bg-sky-600 rounded-md"> {isLeftSidebarOpen ? <ChevronsLeft size={20}/> : <ChevronsRight size={20}/>} </button> <MessageCircleQuestion size={26} className="mr-2 transform -scale-x-100" /> <h1 className="text-lg font-bold">ASAVE Suite</h1> {currentSessionId && <span className="ml-3 text-xs px-2 py-0.5 bg-sky-500 rounded-full">Session: {currentSessionId}</span>} </div>
        <div className="flex items-center"> {currentPageView === 'fas_editor_page' && ( <button onClick={() => setCurrentPageView('chat')} className="mr-3 text-xs px-2.5 py-1 bg-sky-500 hover:bg-sky-400 rounded-md flex items-center"> <ChevronsLeft size={14} className="mr-1"/> Chat </button> )} <button onClick={() => { if ((currentSseMessageId || isFasSuggestionsLoading) && sseControllerRef.current) { sseControllerRef.current.abort(); setIsFasSuggestionsLoading(false); } else { addMessage('system', "No active AI task to cancel."); } }} disabled={!currentSseMessageId && !isFasSuggestionsLoading} className="text-xs px-2.5 py-1 bg-orange-500 hover:bg-orange-600 rounded-md shadow-sm disabled:opacity-50"> Cancel AI </button> <button onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} className="ml-2 p-1.5 hover:bg-sky-600 rounded-md"> {isRightSidebarOpen ? <ChevronsRight size={20}/> : <ChevronsLeft size={20}/>} </button> </div>
      </header>

      <div className="flex flex-row flex-grow min-h-0">
        <LeftSidebar isOpen={isLeftSidebarOpen} sessions={availableSessions} currentSessionId={currentSessionId} onLoadSession={handleLoadSession} onCreateNewSession={handleCreateNewSessionFromSidebar} onRefreshSessions={fetchSessionsInternal} />
        <main className="flex-grow flex flex-col bg-slate-200/50 overflow-hidden">
            {currentPageView === 'chat' && (
                 <>
                    <div ref={chatContainerRef} className="flex-grow p-3 space-y-3 overflow-y-auto scrollbar-thin">
                        {chatMessages.map((msg) => ( /* ... same chat message rendering ... */ 
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}> <div className={`max-w-[85%] p-2.5 rounded-xl shadow-sm text-sm ${ msg.sender === 'user' ? 'bg-sky-500 text-white rounded-br-none' : msg.sender === 'ai' ? 'bg-white text-slate-700 rounded-bl-none border border-slate-200' : 'bg-slate-100 text-slate-600 rounded-bl-none border border-slate-200' }`}> <div className="flex items-center mb-1 text-xs opacity-70"> {msg.sender === 'user' ? <User size={12} className="mr-1" /> : msg.sender === 'ai' ? <Bot size={12} className="mr-1" /> : <Settings size={12} className="mr-1" />} <span>{msg.sender.toUpperCase()}</span><span className="mx-1.5 text-[9px]">●</span><span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> </div> {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>} {msg.component && <div className="mt-1">{msg.component}</div>} {msg.isLoading && <Loader2 size={16} className="animate-spin my-1 text-sky-500" />} </div> </div>
                        ))}
                        {/* Render Contract Suggestions in Chat AFTER the main SSE message if any */}
                        {contractSuggestionsForChat.length > 0 && (
                            <div className="my-2 p-2 bg-slate-100 rounded-md border">
                                <p className="text-xs font-medium text-slate-600 mb-1">Contract AI Suggestions ({contractSuggestionsForChat.length}):</p>
                                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
                                {contractSuggestionsForChat.map((sugg, index) => (
                                    <SuggestionCard
                                        key={`${sugg.source_agent_name}-${sugg.clause_id}-${index}`}
                                        suggestionPackage={sugg}
                                        onAccept={() => { navigator.clipboard.writeText(sugg.suggestion_details.proposed_text); addMessage('system', `Copied suggestion for clause ${sugg.clause_id}.`);}}
                                        onReject={() => { addMessage('system', `Rejected suggestion for clause ${sugg.clause_id}.`); setContractSuggestionsForChat(prev => prev.filter((_, i) => i !== index))}}
                                        isHighlighted={highlightedContractSuggestionId === `${sugg.source_agent_name}-${sugg.clause_id}-${index}`}
                                    />
                                ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <footer className="p-2.5 border-t border-slate-300 bg-slate-50 shrink-0"> <div className="flex items-center space-x-2"> <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleUserChatInput()} placeholder="Type your command or message..." className="flex-grow input-field py-2 px-3 text-sm"/> <button onClick={handleUserChatInput} className="btn-primary py-2 px-3.5"><Send size={18} /></button> </div> </footer>
                </>
            )}
            {currentPageView === 'fas_editor_page' && ( <FasEditorPage initialContent={fasEditorInitialContent} documentId={fasEditorDocumentId} sessionId={currentSessionId} onGetAIAssistance={handleGetAIAssistanceForFASFromEditor} onSaveRequest={onFasDocumentSaveFromEditor} suggestionToApply={suggestionToApplyToEditor} onSuggestionHandled={handleFasSuggestionAppliedOrDismissedInEditor} onNotify={sendSystemNotification} /> )}
        </main>
        <RightSidebar isOpen={isRightSidebarOpen} isSystemInitialized={isSystemInitialized} isLoadingFas={isExtractingText} isLoadingContract={isProcessingContract} onSetupSystem={() => setActiveModal('init_system')} onLoadFas={(file) => { if (file) handleFasFileForEditor(file);}} onClauseContract={() => { setContractHelperMode('clause_by_clause'); setActiveModal('contract_clause_input'); }} onFullContract={() => { setContractHelperMode('full_contract'); setActiveModal('contract_full_input'); }} onLoadSampleContract={() => { /* ... */ }} isEditorViewActive={currentPageView === 'fas_editor_page'} fasEditorSuggestions={fasEditorSuggestions} isFasSuggestionsLoading={isFasSuggestionsLoading} onAcceptFasEditorSuggestion={handleAcceptFasEditorSuggestion} onRejectFasEditorSuggestion={handleRejectFasEditorSuggestion} minConfidenceForHighlight={minConfidenceForHighlight} onSetMinConfidenceForHighlight={setMinConfidenceForHighlight} onProcessContextualUpdate={() => { setActiveModal('contextual_update_input'); setContextualUpdateTextModal(''); if(knownFasDocumentIds.length > 0) setTargetFasForUpdateModal(knownFasDocumentIds[0]); else setTargetFasForUpdateModal(''); }} />
      </div>

      {/* Modals */}
      {activeModal === 'init_system' && ( <Modal title="System Setup & Session Management" onClose={() => setActiveModal(null)}> <div className="space-y-3 text-sm"> {/* ... Init Modal Content from previous version, using *Modal state variables ... */} <div><label>Load Existing Session:</label><select value={selectedSessionToLoadModal} onChange={(e)=>{setSelectedSessionToLoadModal(e.target.value); if(e.target.value) setNewSessionNameModal('');}} className="input-field text-xs"> <option value="">-- Select Session --</option> {availableSessions.map(s=><option key={s.session_id} value={s.session_id}>{s.session_id}</option>)}</select></div> <hr/> <div><label>Or, Create New Session Name:</label><input type="text" value={newSessionNameModal} onChange={(e)=>{setNewSessionNameModal(e.target.value); if(e.target.value) setSelectedSessionToLoadModal('');}} className="input-field text-xs" disabled={!!selectedSessionToLoadModal}/>{newSessionNameModal && <label><input type="checkbox" checked={overwriteSessionModal} onChange={e=>setOverwriteSessionModal(e.target.checked)}/>Overwrite</label>}</div> <hr/> <FileUploader label="FAS PDF(s)" onFilesUploaded={setFasFilesForInitModal} id="m-fas" multiple accept=".pdf"/> <FileUploader label="SS PDF(s)" onFilesUploaded={setSsFilesForInitModal} id="m-ss" multiple accept=".pdf"/> <FileUploader label="Rules JSON" onFilesUploaded={f=>setRulesFileForInitModal(f as File)} id="m-rules" accept=".json"/> {/* Library selectors can be added here too */} <button onClick={handleInitializeBackend} className="btn-primary w-full mt-2"> {isLoading ? <Loader2 className="inline animate-spin"/> : '🚀'} Apply Configuration</button> </div> </Modal> )}
      {activeModal === 'contract_clause_input' && ( /* ... same ... */ <Modal title="Contract Suite: Clause-by-Clause" onClose={() => setActiveModal(null)}> <div className="space-y-3 text-sm"> <div><label>Contract Type:</label><select value={contractType} onChange={e=>setContractType(e.target.value)} className="input-field"><option>Salam</option><option>Mudarabah</option></select></div> <div><label>Clauses (one/line):</label><textarea value={clientClausesInput} onChange={e=>setClientClausesInput(e.target.value)} rows={8} className="input-field font-mono text-xs" /></div> <div><label>Context:</label><textarea value={overallContractCtx} onChange={e=>setOverallContractCtx(e.target.value)} rows={2} className="input-field" /></div> <button onClick={handleValidateContractTerms} className="w-full btn-teal">Validate</button> </div> </Modal> )}
      {activeModal === 'contract_full_input' && ( /* ... same ... */ <Modal title="Contract Suite: Full Contract" onClose={() => setActiveModal(null)}> <div className="space-y-3 text-sm"> <div><label>Contract Type:</label><select value={contractType} onChange={e=>setContractType(e.target.value)} className="input-field"><option>Salam</option><option>Mudarabah</option></select></div> <div><label>Full Text:</label><textarea value={fullContractTextInput} onChange={e=>setFullContractTextInput(e.target.value)} rows={10} className="input-field font-mono text-xs" /></div> <div><label>Context:</label><textarea value={overallContractCtx} onChange={e=>setOverallContractCtx(e.target.value)} rows={2} className="input-field" /></div> <button onClick={handleValidateContractTerms} className="w-full btn-teal">Review</button> </div> </Modal> )}
      {activeModal === 'contextual_update_input' && (
        <Modal title="Contextual Update Analysis" onClose={() => setActiveModal(null)}>
            <div className="space-y-3 text-sm">
                <div>
                    <label htmlFor="cua-text" className="block font-medium text-slate-700">New Contextual Information (News, Guideline, etc.):</label>
                    <textarea id="cua-text" value={contextualUpdateTextModal} onChange={(e) => setContextualUpdateTextModal(e.target.value)} rows={6} className="input-field" placeholder="Paste the new text here..."/>
                </div>
                <div>
                    <label htmlFor="cua-target-fas" className="block font-medium text-slate-700">Target FAS Document ID:</label>
                    {knownFasDocumentIds.length > 0 ? (
                        <select id="cua-target-fas" value={targetFasForUpdateModal} onChange={(e) => setTargetFasForUpdateModal(e.target.value)} className="input-field">
                            <option value="">-- Select Target FAS --</option>
                            {knownFasDocumentIds.map(docId => <option key={docId} value={docId}>{docId}</option>)}
                        </select>
                    ) : (
                        <input type="text" id="cua-target-fas" value={targetFasForUpdateModal} onChange={(e) => setTargetFasForUpdateModal(e.target.value)} className="input-field" placeholder="e.g., FAS-17.pdf (Load one first if list empty)"/>
                    )}
                </div>
                <button onClick={handleProcessContextualUpdate} disabled={isLoading} className="w-full btn-indigo">
                    {isLoading ? <Loader2 className="inline mr-2 h-5 w-5 animate-spin"/> : <Search size={16} className="mr-1.5"/>} Analyze Impact
                </button>
            </div>
        </Modal>
      )}
    </div>
  );
};

// --- Sidebar & Page Components ---
interface LeftSidebarProps { /* ... same ... */ isOpen: boolean; sessions: SessionInfo[]; currentSessionId: string | null; onLoadSession: (sessionId: string) => void; onCreateNewSession: () => void; onRefreshSessions: () => void; }
const LeftSidebar: React.FC<LeftSidebarProps> = ({ isOpen, sessions, currentSessionId, onLoadSession, onCreateNewSession, onRefreshSessions }) => { /* ... same ... */ if (!isOpen) return null; return ( <aside className="w-64 bg-slate-50 border-r border-slate-300 p-3 flex flex-col shrink-0 text-sm space-y-3 scrollbar-thin overflow-y-auto"> <div className="flex justify-between items-center"> <h2 className="font-semibold text-slate-700 flex items-center"><Database size={16} className="mr-1.5 text-sky-600"/>Sessions</h2> <button onClick={onRefreshSessions} className="text-xs p-1 hover:bg-slate-200 rounded-md text-slate-500">Refresh</button> </div> <button onClick={onCreateNewSession} className="w-full btn-secondary-small flex items-center justify-center py-1.5 text-xs"> <PlusCircle size={14} className="mr-1.5"/> Create/Initialize New </button> {sessions.length > 0 ? ( <ul className="space-y-1.5 text-xs"> {sessions.map(s => ( <li key={s.session_id}> <button onClick={() => onLoadSession(s.session_id)} className={`w-full text-left p-1.5 rounded hover:bg-sky-100 ${s.session_id === currentSessionId ? 'bg-sky-100 border border-sky-500 font-medium text-sky-700' : 'border border-transparent'}`} title={`FAS: ${s.has_fas_db?'Yes':'No'}, SS: ${s.has_ss_db?'Yes':'No'}\nModified: ${s.last_modified}`}> <FolderOpenDot size={12} className="inline mr-1 opacity-70"/> {s.session_id} </button> </li> ))} </ul> ) : <p className="text-xs text-slate-500 italic">No saved sessions found.</p>} </aside> ); };

interface RightSidebarProps { /* ... updated props ... */
  isOpen: boolean; isSystemInitialized: boolean; isLoadingFas: boolean; isLoadingContract: boolean;
  onSetupSystem: () => void; onLoadFas: (file: File | null) => void; onClauseContract: () => void; onFullContract: () => void; onLoadSampleContract: () => void;
  isEditorViewActive: boolean; fasEditorSuggestions: ValidatedSuggestionPackage[]; isFasSuggestionsLoading: boolean;
  onAcceptFasEditorSuggestion: (suggestion: ValidatedSuggestionPackage) => void;
  onRejectFasEditorSuggestion: (suggestion: ValidatedSuggestionPackage) => void;
  minConfidenceForHighlight: number; onSetMinConfidenceForHighlight: (value: number) => void;
  onProcessContextualUpdate: () => void;
}
const RightSidebar: React.FC<RightSidebarProps> = ({ /* ... destructured props ... */
  isOpen, isSystemInitialized, isLoadingFas, isLoadingContract, onSetupSystem, onLoadFas, onClauseContract, onFullContract, onLoadSampleContract,
  isEditorViewActive, fasEditorSuggestions, isFasSuggestionsLoading, onAcceptFasEditorSuggestion, onRejectFasEditorSuggestion,
  minConfidenceForHighlight, onSetMinConfidenceForHighlight, onProcessContextualUpdate
}) => { /* ... same structure, but with new section for confidence threshold and contextual update ... */
  if (!isOpen) return null;
  const actionButtonClass = "w-full flex items-center text-sm p-2.5 rounded-md hover:bg-slate-200 transition-colors text-slate-700";
  const disabledClass = "opacity-50 cursor-not-allowed";

  const highlightedFasSuggestionId = useMemo(() => {
    if (!isEditorViewActive || !fasEditorSuggestions.length) return null;
    let highestConfidence = -1;
    let bestSuggestion: ValidatedSuggestionPackage | null = null;
    fasEditorSuggestions.forEach(sugg => {
        const score = sugg.suggestion_details.confidence_score ?? 0;
        if (score >= minConfidenceForHighlight && score > highestConfidence) {
            highestConfidence = score;
            bestSuggestion = sugg;
        }
    });
    // Create a stable ID for the best suggestion, e.g., based on its proposed text or a unique part
    return bestSuggestion ? `${bestSuggestion.source_agent_name}-${bestSuggestion.suggestion_details.proposed_text.slice(0,20)}` : null;
  }, [fasEditorSuggestions, minConfidenceForHighlight, isEditorViewActive]);


  return ( <aside className="w-72 bg-slate-50 border-l border-slate-300 p-3 flex flex-col shrink-0 space-y-2 scrollbar-thin overflow-y-auto"> <h2 className="font-semibold text-slate-700 mb-2 flex items-center text-sm"><Settings size={16} className="mr-1.5 text-sky-600"/>Controls</h2> <button onClick={onSetupSystem} className={`${actionButtonClass} bg-sky-50 hover:bg-sky-100`}> <SlidersHorizontal size={18} className="mr-2 text-sky-600"/> System Setup / Sessions </button> <hr/> <p className="text-xs font-medium text-slate-500 mt-1">FAS Document Suite</p> <FileUploader label="" accept=".pdf" onFilesUploaded={(files) => onLoadFas(files as File)} id="sidebar-fas-loader"> <div className={`${actionButtonClass} ${(!isSystemInitialized || isLoadingFas) && disabledClass} group`}> {isLoadingFas ? <Loader2 size={18} className="mr-2 animate-spin text-sky-600"/> : <BookOpen size={18} className="mr-2 text-sky-600"/>} Load FAS PDF for Editor </div> </FileUploader>
      {isEditorViewActive && (
        <div className="mt-1 p-1.5 border-t border-slate-200">
            <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-medium text-slate-500 flex items-center"> <BrainCircuit size={14} className="mr-1 text-purple-600"/> Editor AI Suggestions </p>
                <div className="flex items-center text-xs"> <label htmlFor="confidenceThreshold" className="mr-1 text-slate-500">Min:</label> <input type="number" id="confidenceThreshold" value={minConfidenceForHighlight} onChange={e => onSetMinConfidenceForHighlight(parseInt(e.target.value,10) || 0)} min="0" max="100" step="5" className="w-12 input-field px-1 py-0 text-[11px] text-center"/> <span className="ml-0.5">%</span> </div>
            </div>
            {isFasSuggestionsLoading && <div className="flex justify-center py-2"><Loader2 size={20} className="animate-spin text-purple-500"/></div>}
            {!isFasSuggestionsLoading && fasEditorSuggestions.length === 0 && <p className="text-xs text-slate-400 italic">No suggestions yet.</p>}
            {fasEditorSuggestions.length > 0 && ( <div className="space-y-1.5 max-h-[calc(100vh-550px)] overflow-y-auto scrollbar-thin pr-0.5"> {fasEditorSuggestions.map((sugg, idx) => ( <SuggestionCard key={`${sugg.source_agent_name}-${idx}-${sugg.suggestion_details.proposed_text.slice(0,10)}`} suggestionPackage={sugg} onAccept={() => onAcceptFasEditorSuggestion(sugg)} onReject={() => onRejectFasEditorSuggestion(sugg)} isHighlighted={highlightedFasSuggestionId === `${sugg.source_agent_name}-${sugg.suggestion_details.proposed_text.slice(0,20)}`} /> ))} </div> )}
        </div>
      )}
      <hr className={`${isEditorViewActive ? 'mt-2' : ''}`}/>
      <p className="text-xs font-medium text-slate-500 mt-1">Contextual Analysis</p>
      <button onClick={onProcessContextualUpdate} className={`${actionButtonClass} ${!isSystemInitialized && disabledClass}`}> <Lightbulb size={18} className="mr-2 text-indigo-600"/> Process Contextual Update </button>
      <hr/>
      <p className="text-xs font-medium text-slate-500 mt-1">Shari'ah Contract Suite</p>
      <button onClick={onClauseContract} className={`${actionButtonClass} ${(!isSystemInitialized || isLoadingContract) && disabledClass}`}> <ListChecks size={18} className="mr-2 text-teal-600"/> Clause-by-Clause Review </button> <button onClick={onFullContract} className={`${actionButtonClass} ${(!isSystemInitialized || isLoadingContract) && disabledClass}`}> <FileSearch2 size={18} className="mr-2 text-teal-600"/> Full Contract Review </button> <button onClick={onLoadSampleContract} className={`${actionButtonClass} border border-dashed border-slate-300 hover:border-teal-400`}> <FileSignature size={18} className="mr-2 text-teal-500"/> Load Sample Contract </button> {isLoadingContract && <div className="text-xs text-teal-600 flex items-center justify-center p-1"><Loader2 size={14} className="animate-spin mr-1"/>Contract AI Processing...</div>} </aside> );
};

interface FasEditorPageProps { /* ... same + onNotify ... */ 
  initialContent: string; documentId: string; sessionId: string | null; 
  onGetAIAssistance: (selectedText: string, documentId: string, currentMarkdown: string) => void; 
  onSaveRequest: (documentId: string, newContent: string, summary: string) => void; 
  suggestionToApply: ValidatedSuggestionPackage | null; 
  onSuggestionHandled: () => void; 
  onNotify: (message: string, type?: 'info' | 'error' | 'success') => void;
}
const FasEditorPage: React.FC<FasEditorPageProps> = ({ /* ... same + onNotify ... */ 
    initialContent, documentId, sessionId, onGetAIAssistance, onSaveRequest, suggestionToApply, onSuggestionHandled, onNotify
}) => { /* ... same implementation, but uses onNotify instead of alert ... */ 
  const [markdownContent, setMarkdownContent] = useState<string>(initialContent); const [selectedEditorText, setSelectedEditorText] = useState<string>(''); const editorRef = useRef<HTMLTextAreaElement>(null); const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit'); const [versions, setVersions] = useState<any[]>([]); const [showVersionsModal, setShowVersionsModal] = useState(false);
  useEffect(() => { setMarkdownContent(initialContent); }, [initialContent]);
  useEffect(() => { const editor = editorRef.current; if (viewMode === 'edit' && editor) { const updateSelection = () => { const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd); if (selected.trim()) setSelectedEditorText(selected.trim()); else setSelectedEditorText(''); }; editor.addEventListener('select', updateSelection); editor.addEventListener('keyup', updateSelection); editor.addEventListener('mouseup', updateSelection); return () => { editor.removeEventListener('select', updateSelection); editor.removeEventListener('keyup', updateSelection); editor.removeEventListener('mouseup', updateSelection); }; } else { setSelectedEditorText(''); } }, [viewMode, markdownContent]);
  useEffect(() => { if (suggestionToApply && suggestionToApply.suggestion_details.proposed_text) { const original = suggestionToApply.suggestion_details.original_text || selectedEditorText; const proposed = suggestionToApply.suggestion_details.proposed_text; const currentEditorValue = editorRef.current?.value || markdownContent; const startIndex = currentEditorValue.indexOf(original); if (startIndex !== -1) { const newContent = currentEditorValue.substring(0, startIndex) + proposed + currentEditorValue.substring(startIndex + original.length); setMarkdownContent(newContent); if (editorRef.current) { const newCursorPos = startIndex + proposed.length; setTimeout(() => { editorRef.current?.focus(); editorRef.current?.setSelectionRange(newCursorPos, newCursorPos); }, 0); } setSelectedEditorText(proposed); } else { navigator.clipboard.writeText(proposed); onNotify("Original text snippet not found in editor. Proposed text copied.", "info"); } onSuggestionHandled(); } }, [suggestionToApply, onSuggestionHandled, selectedEditorText, markdownContent, onNotify]);
  const handleAIAssistClick = () => { if (selectedEditorText) onGetAIAssistance(selectedEditorText, documentId, markdownContent); else onNotify("Please select text in the editor first.", "info"); };
  const handleSaveCurrentVersion = async () => { if (!sessionId || !documentId) { onNotify("Session or document ID missing, cannot save.", "error"); return; } const summary = `Saved: ${new Date().toLocaleTimeString()}`; try { const response = await axios.post(`${API_BASE_URL}/document/${sessionId}/${documentId}/save_version`, { markdown_content: markdownContent, change_summary: summary }); if (response.data.status === 'success') { onNotify(`Version ${response.data.version_id} saved!`, "success"); fetchVersions(); } else { onNotify(`Failed to save version: ${response.data.message}`, "error"); } onSaveRequest(documentId, markdownContent, summary); } catch (error: any) { onNotify(`Error saving version: ${error.response?.data?.message || error.message}`, "error"); } };
  const fetchVersions = async () => { if (!sessionId || !documentId) return; try { const response = await axios.get(`${API_BASE_URL}/document/${sessionId}/${documentId}/versions`); if (response.data.status === 'success') setVersions(response.data.versions); else onNotify(`Failed to fetch versions: ${response.data.message}`, "error"); } catch (error: any) { onNotify(`Error fetching versions: ${(error as Error).message}`, "error"); } };
  const handleRevertToVersion = async (versionId: string) => { if (!sessionId || !documentId) { onNotify("Cannot revert: Session/Doc ID missing.", "error"); return; } try { const response = await axios.post(`${API_BASE_URL}/document/${sessionId}/${documentId}/revert_to_version`, { version_id_to_revert_to: versionId }); if (response.data.status === 'success') { setMarkdownContent(response.data.reverted_markdown_content); onNotify(`Reverted to version ${versionId}.`, "success"); fetchVersions(); setShowVersionsModal(false); } else { onNotify(`Failed to revert: ${response.data.message}`, "error"); } } catch (error: any) { onNotify(`Error reverting: ${error.response?.data?.message || error.message}`, "error"); } };
  useEffect(() => { if(sessionId && documentId) fetchVersions(); }, [sessionId, documentId]);
  return ( /* ... same FasEditorPage JSX ... */ <div className="p-4 h-full flex flex-col bg-white overflow-hidden"> <h2 className="text-lg font-semibold text-slate-700 mb-2 shrink-0">FAS Editor: <span className="font-mono text-sky-600">{documentId}</span></h2> <div className="mb-2 space-x-2 shrink-0"> <button onClick={() => setViewMode('edit')} className={`btn-toggle ${viewMode === 'edit' ? 'btn-toggle-active' : ''}`}><Edit size={14}/> Edit</button> <button onClick={() => setViewMode('preview')} className={`btn-toggle ${viewMode === 'preview' ? 'btn-toggle-active' : ''}`}><Eye size={14}/> Preview</button> <button onClick={handleSaveCurrentVersion} className="btn-secondary-small"><Save size={14}/> Save Version</button> <button onClick={() => {fetchVersions(); setShowVersionsModal(true);}} className="btn-secondary-small"><History size={14}/> Versions ({versions.length})</button> <button onClick={handleAIAssistClick} className="btn-primary-small" disabled={!selectedEditorText}><MessageSquare size={14}/> Get AI Help</button> </div> {selectedEditorText && viewMode === 'edit' && ( <div className="p-1.5 my-1 bg-sky-50 border border-sky-200 rounded-md text-xs shrink-0"> <p className="font-medium text-sky-700">Selected for AI:</p> <pre className="bg-white p-1 rounded max-h-16 overflow-y-auto text-[11px]"><code>{selectedEditorText}</code></pre> </div> )} <div className="flex-grow min-h-0"> {viewMode === 'edit' ? ( <textarea ref={editorRef} value={markdownContent} onChange={(e) => setMarkdownContent(e.target.value)} className="w-full h-full textarea-field text-sm font-mono resize-none"/> ) : ( <div className="w-full h-full markdown-preview p-2 border rounded bg-slate-50 text-sm overflow-y-auto scrollbar-thin"><ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownContent || "No content."}</ReactMarkdown></div> )} </div> {showVersionsModal && ( <Modal title={`Versions for: ${documentId}`} onClose={() => setShowVersionsModal(false)}> {versions.length > 0 ? ( <ul className="space-y-1.5 text-xs max-h-80 overflow-y-auto"> {versions.map((v: any) => ( <li key={v.version_id} className="p-1.5 border rounded flex justify-between items-center hover:bg-slate-50"> <div> <p><strong>ID:</strong> {v.version_id}</p> <p className="text-[10px] text-slate-500">Saved: {new Date(v.timestamp).toLocaleString()}</p> <p className="text-[10px] italic">"{v.summary || "No summary"}"</p> </div> <button onClick={() => handleRevertToVersion(v.version_id)} className="btn-secondary-small text-[10px] px-1.5 py-0.5">Revert</button> </li> ))} </ul> ) : <p className="text-xs text-slate-500">No versions found.</p>} </Modal> )} </div> );
};

interface ModalProps { /* ... same ... */ title: string; onClose: () => void; children: React.ReactNode; size?: 'normal' | 'large' | 'xlarge'; }
const Modal: React.FC<ModalProps> = ({ title, onClose, children, size = 'normal' }) => { /* ... same Modal code ... */  let modalWidthClass = 'max-w-lg'; if (size === 'large') modalWidthClass = 'max-w-3xl'; if (size === 'xlarge') modalWidthClass = 'max-w-6xl'; return ( <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50 p-4"> <div className={`bg-white rounded-lg shadow-xl w-full ${modalWidthClass} max-h-[90vh] flex flex-col`}> <div className="flex justify-between items-center p-3 border-b border-slate-200"> <h3 className="text-md font-semibold text-slate-700">{title}</h3> <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"> <X size={20} /> </button> </div> <div className="p-3 overflow-y-auto scrollbar-thin"> {children} </div> </div> </div> );};
const renderLibraryItemCheckbox = ( item: LibraryPdfItem, selectedArray: string[], setSelectedArray: React.Dispatch<React.SetStateAction<string[]>>, prefix: 'fas' | 'ss' ) => { /* ... same ... */ if (item.type === 'file') { return ( <div key={`${prefix}-${item.name}`} className="flex items-center"> <input type="checkbox" id={`${prefix}-lib-${item.name}`} value={item.name} checked={selectedArray.includes(item.name)} onChange={(e) => { const name = e.target.value; setSelectedArray(prev => e.target.checked ? [...prev, name] : prev.filter(n => n !== name)); }} className="mr-1 focus:ring-sky-500 h-3 w-3"/> <label htmlFor={`${prefix}-lib-${item.name}`} className="truncate">{item.name}</label> </div> ); } else if (item.type === 'directory' && item.files) { return ( <div key={`${prefix}-dir-${item.name}`} className="ml-0.5 mt-0.5"> <p className="text-[10px] font-medium text-slate-500">{item.name}/</p> <div className="pl-1.5 border-l border-slate-200"> {item.files.map(f => ( <div key={`${prefix}-lib-${item.name}-${f}`} className="flex items-center"> <input type="checkbox" id={`${prefix}-lib-${item.name}-${f}`} value={`${item.name}/${f}`} checked={selectedArray.includes(`${item.name}/${f}`)} onChange={(e) => { const path = e.target.value; setSelectedArray(prev => e.target.checked ? [...prev, path] : prev.filter(n => n !== path)); }} className="mr-1 focus:ring-sky-500 h-3 w-3"/> <label htmlFor={`${prefix}-lib-${item.name}-${f}`} className="truncate">{f}</label> </div> ))} </div> </div> ); } return null;};

export default App;