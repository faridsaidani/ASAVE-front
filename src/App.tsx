/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/App.tsx (New Root Router Component)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import MainLayout from './layouts/MainLayout';
import StandardsEnhancementPage from './pages/StandardsEnhancementPage';
import ContractVerificationPage from './pages/ContractVerificationPage';
import ChatPage from './pages/ChatPage';
import Modal from './components/Modal';
import FileUploader from './components/FileUploader';
import SrmaModal from './components/SrmaModal'; // Import SRMA Modal
import { renderLibraryItemCheckbox } from './utils/uiHelpers';


import {
    getApiStatus,
    analyzeContextualUpdate,
    mineShariahRules, // Import SRMA API function
} from './services/api';

import type { LibraryPdfItem, SessionInfo, ChatMessage, ModalType, InitResponse, ApiStatusResponse, SrmaFileMetadata, SrmaResponse } from './types';
import { Loader2, Search, Info as InfoIcon, PocketKnife } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const App: React.FC = () => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState<string>('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const [isSystemInitialized, setIsSystemInitialized] = useState<boolean>(false);
  const [libraryPdfs, setLibraryPdfs] = useState<LibraryPdfItem[]>([]);
  const [availableSessions, setAvailableSessions] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [apiMessage, setApiMessage] = useState<{type: 'info' | 'success' | 'error' | 'warning', text: string} | null>(null);
  
  const [fasFilesForInitModal, setFasFilesForInitModal] = useState<FileList | null>(null);
  const [ssFilesForInitModal, setSsFilesForInitModal] = useState<FileList | null>(null);
  const [rulesFileForInitModal, setRulesFileForInitModal] = useState<File | null>(null);
  const [selectedLibraryFasModal, setSelectedLibraryFasModal] = useState<string[]>([]);
  const [selectedLibrarySsModal, setSelectedLibrarySsModal] = useState<string[]>([]);
  const [selectedSessionToLoadModal, setSelectedSessionToLoadModal] = useState<string>('');
  const [newSessionNameModal, setNewSessionNameModal] = useState<string>('');
  const [overwriteSessionModal, setOverwriteSessionModal] = useState<boolean>(false);

  const [isGlobalLoading, setIsGlobalLoading] = useState<boolean>(false); // For non-SSE blocking general tasks
  
  const [contextualUpdateTextModal, setContextualUpdateTextModal] = useState("");
  const [targetFasForUpdateModal, setTargetFasForUpdateModal] = useState("");
  const [knownFasDocumentIdsForCUA, setKnownFasDocumentIdsForCUA] = useState<string[]>([]);

  // SRMA State
  const [isProcessingSrma, setIsProcessingSrma] = useState<boolean>(false);

  const globalSseControllerRef = useRef<AbortController | null>(null); // For global SSE tasks if any, pages should manage their own primarily
  const navigate = useNavigate();
  const location = useLocation();

  const sendSystemNotification = useCallback((message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    setApiMessage({ type, text: message });
    // Auto-dismiss can be handled in MainLayout's useEffect for apiMessage
  }, []);
  
  const addMessageToChat = useCallback((sender: ChatMessage['sender'], text?: string, component?: React.ReactNode, isLoadingPlaceholder: boolean = false): string => {
    const newMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setChatMessages(prev => [...prev, { id: newMessageId, sender, text, component, timestamp: new Date(), isLoading: isLoadingPlaceholder }]);
    return newMessageId;
  }, []);

  const updateChatMessage = useCallback((messageId: string, newText?: string, newComponent?: React.ReactNode, stopLoading: boolean = false) => {
    setChatMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, text: newText !== undefined ? newText : msg.text, component: newComponent !== undefined ? newComponent : msg.component, isLoading: stopLoading ? false : msg.isLoading } : msg
    ));
  }, []);

  useEffect(() => {
    addMessageToChat('ai', "👋 Welcome to ASAVE Interactive Suite! Select a tool from the navigation or sidebar.");
    getApiStatus().then(statusData => {
      if (statusData?.asave_initialized) {
        setIsSystemInitialized(true);
        if (statusData.current_session_id) setCurrentSessionId(statusData.current_session_id);
        sendSystemNotification(statusData.current_session_id ? `Connected. Active Session: ${statusData.current_session_id}` : 'ASAVE backend initialized.', 'success');
      } else {
        sendSystemNotification('ASAVE backend needs initialization for full context features.', 'info');
      }
    }).catch(error => sendSystemNotification(`Error connecting to ASAVE API: ${(error as Error).message}`, 'error'));
    
    fetchLibraryPdfsInternal();
    fetchSessionsInternal();
  }, [addMessageToChat, sendSystemNotification]);

  const fetchLibraryPdfsInternal = useCallback(async () => {
    try {
      const response = await axios.get<{status: string, pdf_files: LibraryPdfItem[], message?: string}>(`${API_BASE_URL}/list_library_pdfs`);
      if (response.data.status === 'success') setLibraryPdfs(response.data.pdf_files || []);
      else sendSystemNotification(`Error fetching library PDFs: ${response.data.message}`, 'error');
    } catch (error: any) { sendSystemNotification(`Error fetching library PDFs: ${error.message}`, 'error'); }
  }, [sendSystemNotification]);

  const fetchSessionsInternal = useCallback(async () => {
    try {
      const response = await axios.get<{status: string, sessions: SessionInfo[], message?: string}>(`${API_BASE_URL}/list_sessions`);
      if (response.data.status === 'success') setAvailableSessions(response.data.sessions || []);
      else sendSystemNotification(`Error fetching sessions: ${response.data.message}`, 'error');
    } catch (error: any) { sendSystemNotification(`Error fetching sessions: ${error.message}`, 'error'); }
  }, [sendSystemNotification]);

  const handleInitializeBackend = useCallback(async () => {
    if (!selectedSessionToLoadModal && !fasFilesForInitModal && selectedLibraryFasModal.length === 0 && selectedLibrarySsModal.length === 0 && !rulesFileForInitModal) {
      sendSystemNotification("To initialize, please select knowledge base files to process or a session to load.", 'warning');
      return;
    }
    setIsGlobalLoading(true); sendSystemNotification('Initializing backend system...', 'info');
    const formData = new FormData();
    
    if (selectedSessionToLoadModal) {
        formData.append('load_session_id', selectedSessionToLoadModal);
    }
    if (newSessionNameModal.trim() && !selectedSessionToLoadModal) {
        formData.append('save_as_session_name', newSessionNameModal.trim());
        if (overwriteSessionModal) formData.append('overwrite_session', 'true');
    }
    if (fasFilesForInitModal) Array.from(fasFilesForInitModal).forEach(f => formData.append('fas_files_upload', f, f.name));
    if (ssFilesForInitModal) Array.from(ssFilesForInitModal).forEach(f => formData.append('ss_files_upload', f, f.name));
    if (rulesFileForInitModal) formData.append('shariah_rules_explicit_file_upload', rulesFileForInitModal, rulesFileForInitModal.name);
    if (selectedLibraryFasModal?.length) formData.append('library_fas_filenames', JSON.stringify(selectedLibraryFasModal));
    if (selectedLibrarySsModal?.length) formData.append('library_ss_filenames', JSON.stringify(selectedLibrarySsModal));
    
    try {
      const response = await axios.post<InitResponse>(`${API_BASE_URL}/initialize`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const data = response.data;
      sendSystemNotification(`Backend Init ${data.status}: ${data.message}`, data.status === 'success' ? 'success' : 'error');
      if (data.status === 'success') {
        setIsSystemInitialized(true); setCurrentSessionId(data.session_id || null);
        fetchSessionsInternal();
        if (newSessionNameModal && !selectedSessionToLoadModal) setNewSessionNameModal('');
        setActiveModal(null);
        setFasFilesForInitModal(null); setSsFilesForInitModal(null); setRulesFileForInitModal(null);
        setSelectedLibraryFasModal([]); setSelectedLibrarySsModal([]);
      } else { setIsSystemInitialized(false); setCurrentSessionId(null); }
    } catch (error: any) {
      sendSystemNotification(`Initialization failed: ${error.response?.data?.message || error.message}`, 'error');
      setIsSystemInitialized(false); setCurrentSessionId(null);
    }
    setIsGlobalLoading(false);
  }, [
    selectedSessionToLoadModal, fasFilesForInitModal, ssFilesForInitModal, rulesFileForInitModal, 
    selectedLibraryFasModal, selectedLibrarySsModal, newSessionNameModal, overwriteSessionModal, 
    sendSystemNotification, fetchSessionsInternal
  ]);
  
  const handleLoadSession = useCallback((sessionId: string) => {
    setSelectedSessionToLoadModal(sessionId);
    setNewSessionNameModal(''); 
    setOverwriteSessionModal(false);
    setFasFilesForInitModal(null); setSsFilesForInitModal(null); setRulesFileForInitModal(null);
    setSelectedLibraryFasModal([]); setSelectedLibrarySsModal([]);
    setActiveModal('init_system');
  }, []);

  const handleCreateNewSessionRequest = useCallback(() => {
    setSelectedSessionToLoadModal(''); 
    setNewSessionNameModal(''); 
    setOverwriteSessionModal(false);
    setFasFilesForInitModal(null); setSsFilesForInitModal(null); setRulesFileForInitModal(null);
    setSelectedLibraryFasModal([]); setSelectedLibrarySsModal([]);
    setActiveModal('init_system');
  }, []);
  
  const handleProcessContextualUpdate = useCallback(async () => {
    if (!contextualUpdateTextModal.trim() || !targetFasForUpdateModal.trim()) {
        sendSystemNotification("Please provide new context and select/enter a target FAS ID for CUA.", "warning"); return;
    }
    if (!isSystemInitialized) {
        sendSystemNotification("System not initialized. CUA results may be limited.", "warning");
    }
    setActiveModal(null);
    addMessageToChat('user', `Analyze impact of context on FAS: ${targetFasForUpdateModal}`);
    const analysisMsgId = addMessageToChat('ai', `Analyzing impact on ${targetFasForUpdateModal}...`, undefined, true);
    setIsGlobalLoading(true);
    try {
        const response = await analyzeContextualUpdate({ 
            new_context_text: contextualUpdateTextModal, 
            target_document_id: targetFasForUpdateModal,
        });
        if (response.status === 'success' && response.analysis) {
            const cuaResultDisplay = (
                <div className="text-xs space-y-1 p-2 bg-indigo-50 border border-indigo-200 rounded max-h-96 overflow-y-auto scrollbar-thin">
                    <h5 className="font-semibold text-indigo-700 text-sm">Contextual Update Analysis for {targetFasForUpdateModal}</h5>
                    <p><strong>Overall Assessment:</strong> {response.analysis.overall_assessment}</p>
                    <details>
                        <summary className="cursor-pointer text-indigo-600">Summary of New Context</summary>
                        <p className="pl-2 text-slate-700">{response.analysis.summary_of_new_context}</p>
                    </details>
                    {response.analysis.potential_impact_areas?.length > 0 && (
                        <div>
                            <h6 className="font-medium mt-1">Potential Impact Areas:</h6>
                            <ul className="list-disc pl-4">
                                {response.analysis.potential_impact_areas.map((area: any, idx: number) => (
                                    <li key={idx} className="mt-1">
                                        <p><strong>Excerpt Guess:</strong> "{area.fas_excerpt_guess}"</p>
                                        <p><strong>Reason:</strong> {area.reason_for_impact}</p>
                                        <p><strong>Action:</strong> {area.suggested_action_type}</p>
                                        <p><strong>Key Points:</strong> {area.key_points_from_new_context?.join(', ')}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            );
            updateChatMessage(analysisMsgId, undefined, cuaResultDisplay, true);
        } else {
            updateChatMessage(analysisMsgId, `Error analyzing context (CUA): ${response.message || 'Unknown error'}`, undefined, true);
        }
    } catch (error: any) {
        updateChatMessage(analysisMsgId, `Failed CUA: ${error.response?.data?.message || error.message}`, undefined, true);
    }
    setIsGlobalLoading(false);
  }, [contextualUpdateTextModal, targetFasForUpdateModal, isSystemInitialized, addMessageToChat, updateChatMessage, sendSystemNotification]);

  const addKnownFasDocumentIdForCUA = useCallback((docId: string) => {
    if (docId && !knownFasDocumentIdsForCUA.includes(docId)) {
      setKnownFasDocumentIdsForCUA(prev => [...prev, docId].sort());
    }
  }, [knownFasDocumentIdsForCUA]);

  const handleMineShariahRules = async (filesWithMetadata: SrmaFileMetadata[]) => {
    if (!isSystemInitialized) {
        sendSystemNotification("System not initialized. SRMA functionality might be affected.", "warning");
    }
    if (filesWithMetadata.length === 0) {
        sendSystemNotification("No files provided for rule mining.", "warning");
        return;
    }
    setIsProcessingSrma(true);
    sendSystemNotification("⛏️ Starting Shari'ah Rule Mining process...", "info");
    addMessageToChat('system', `Initiating SRMA with ${filesWithMetadata.length} document(s). This may take a while.`);

    try {
        const response: SrmaResponse = await mineShariahRules(filesWithMetadata);
        if (response.status === 'success') {
            sendSystemNotification(`SRMA Success: ${response.message}. Output: ${response.output_file_path}. Files processed: ${response.num_files_processed}.`, "success");
            addMessageToChat('system', `✅ SRMA complete! Mined rules saved to backend at: ${response.output_file_path}`);
            setActiveModal(null); 
        } else {
            sendSystemNotification(`SRMA Error: ${response.message}`, "error");
            addMessageToChat('system', `❌ SRMA failed: ${response.message}`);
        }
    } catch (error: any) {
        sendSystemNotification(`SRMA Request Failed: ${error.message}`, "error");
        addMessageToChat('system', `❌ SRMA network/request error: ${error.message}`);
    }
    setIsProcessingSrma(false);
  };

  const currentAppPath = location.pathname;

  return (
    <>
      <Routes>
        <Route 
          path="/" 
          element={
            <MainLayout 
              apiMessage={apiMessage}
              setApiMessage={setApiMessage}
              sessions={availableSessions}
              currentSessionId={currentSessionId}
              onLoadSession={handleLoadSession}
              onCreateNewSession={handleCreateNewSessionRequest}
              onRefreshSessions={fetchSessionsInternal}
              onSetupSystem={() => setActiveModal('init_system')}
              isSystemInitialized={isSystemInitialized}
              onProcessContextualUpdate={() => {
                if (currentAppPath.startsWith('/standards-enhancement') && knownFasDocumentIdsForCUA.length > 0) {
                    setTargetFasForUpdateModal(knownFasDocumentIdsForCUA[0]); // Example prefill
                } else {
                    setTargetFasForUpdateModal('');
                }
                setActiveModal('contextual_update_input');
              }}
              onOpenSrmaModal={() => setActiveModal('srma_rule_miner')}
              globalSseControllerRef={globalSseControllerRef} // Could be used by MainLayout for truly global tasks
              addMessageToChat={addMessageToChat}
            />
          }
        >
          <Route 
            index 
            element={
              <ChatPage 
                chatMessages={chatMessages}
                userInput={userInput}
                setUserInput={setUserInput}
                chatContainerRef={chatContainerRef}
                addMessageToChat={addMessageToChat}
                onTriggerInitModal={handleCreateNewSessionRequest}
                onTriggerCUAModal={() => setActiveModal('contextual_update_input')}
                libraryPdfs={libraryPdfs}
              />
            } 
          />
          <Route 
            path="standards-enhancement" 
            element={
              <StandardsEnhancementPage 
                isSystemInitialized={isSystemInitialized}
                currentSessionId={currentSessionId}
                sendSystemNotification={sendSystemNotification}
                addKnownFasDocumentIdForCUA={addKnownFasDocumentIdForCUA}
              />
            } 
          />
          <Route 
            path="contract-verification" 
            element={
              <ContractVerificationPage 
                isSystemInitialized={isSystemInitialized}
                sendSystemNotification={sendSystemNotification}
              />
            } 
          />
        </Route>
      </Routes>

      {activeModal === 'init_system' && ( 
        <Modal 
            title="System Setup & Session Management" 
            onClose={() => setActiveModal(null)} 
            size="large"
            footer={
                <button onClick={handleInitializeBackend} className="w-full btn-primary py-2.5 text-sm" disabled={isGlobalLoading}>
                    {isGlobalLoading ? <Loader2 className="inline mr-2 h-5 w-5 animate-spin"/> : '🚀 '}
                    {selectedSessionToLoadModal ? `Load Session: ${selectedSessionToLoadModal}` : (newSessionNameModal ? `Create & Init: ${newSessionNameModal}`: 'Initialize Configuration')}
                </button>
            }
        >
            <div className="space-y-4 text-sm">
                <div>
                    <h3 className="font-medium text-slate-700 mb-1">Load Existing Session:</h3>
                    <div className="flex items-center gap-2">
                        <select value={selectedSessionToLoadModal} onChange={(e) => {setSelectedSessionToLoadModal(e.target.value); if(e.target.value) {setNewSessionNameModal(''); setOverwriteSessionModal(false);}}} className="input-field text-xs flex-grow">
                            <option value="">-- Select Session to Load --</option>
                            {availableSessions.map(s => <option key={s.session_id} value={s.session_id}>{s.session_id} (FAS:{s.has_fas_db?'✓':'✗'} SS:{s.has_ss_db?'✓':'✗'})</option>)}
                        </select>
                        <button onClick={fetchSessionsInternal} className="btn-secondary-small text-[11px] px-2 py-1 whitespace-nowrap">Refresh List</button>
                    </div>
                </div>
                <hr className="my-3"/>
                <div>
                    <label htmlFor="newSessionNameModalField" className="text-sm font-medium text-slate-700">Or, Create New Session As:</label>
                    <input type="text" id="newSessionNameModalField" value={newSessionNameModal} onChange={(e) => {setNewSessionNameModal(e.target.value); if(e.target.value) setSelectedSessionToLoadModal('');}} placeholder="e.g., MyProject_Q1_FAS_SS (Optional)" className="input-field text-sm mt-1" disabled={!!selectedSessionToLoadModal}/>
                    {newSessionNameModal && !selectedSessionToLoadModal && <label className="text-xs flex items-center mt-1.5 text-slate-600"><input type="checkbox" checked={overwriteSessionModal} onChange={(e) => setOverwriteSessionModal(e.target.checked)} className="mr-1.5 h-3.5 w-3.5"/> Overwrite if session name exists</label>}
                </div>
                <hr className="my-3"/>
                <p className="text-sm font-medium text-slate-700">Provide Knowledge Base Files (for new or to add to loaded session):</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <FileUploader label="FAS PDF(s)" accept=".pdf" multiple onFilesUploaded={setFasFilesForInitModal} id="modal-fas-init" />
                    <FileUploader label="SS PDF(s)" accept=".pdf" multiple onFilesUploaded={setSsFilesForInitModal} id="modal-ss-init" />
                    <FileUploader label="Rules JSON/JSONL (Optional)" accept=".json,.jsonl" onFilesUploaded={(f) => setRulesFileForInitModal(f as File)} id="modal-rules-init" />
                </div>
                {libraryPdfs.length > 0 && (
                    <div>
                        <h3 className="text-sm font-medium text-slate-700 mb-1 mt-2">Or Select from Server Library:</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-40 overflow-y-auto border p-2 rounded-md bg-slate-50/50">
                            <div> <p className="font-semibold text-xs text-slate-600 mb-1">FAS Library Files:</p> {libraryPdfs.filter(i => i.name.toLowerCase().includes('fas') || i.type === 'directory' && i.files?.some(f => f.toLowerCase().includes('fas'))).map(item => renderLibraryItemCheckbox(item, selectedLibraryFasModal, setSelectedLibraryFasModal, 'fas'))} </div>
                            <div> <p className="font-semibold text-xs text-slate-600 mb-1">SS Library Files:</p> {libraryPdfs.filter(i => i.name.toLowerCase().includes('ss') || i.name.toLowerCase().includes('shariah') || i.type === 'directory' && i.files?.some(f => f.toLowerCase().includes('ss') || f.toLowerCase().includes('shariah'))).map(item => renderLibraryItemCheckbox(item, selectedLibrarySsModal, setSelectedLibrarySsModal, 'ss'))} </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
      )}
      {activeModal === 'contextual_update_input' && (
          <Modal 
            title="Contextual Update Analysis" 
            onClose={() => setActiveModal(null)}
            footer={
                <button onClick={handleProcessContextualUpdate} disabled={isGlobalLoading} className="w-full btn-indigo py-2.5 text-sm">
                    {isGlobalLoading ? <Loader2 className="inline mr-2 h-5 w-5 animate-spin"/> : <Search size={16} className="mr-1.5"/>} Analyze Impact
                </button>
            }
          >
              <div className="space-y-4 text-sm">
                  <div>
                      <label htmlFor="cua-text" className="block font-medium text-slate-700 mb-1">New Contextual Information:</label>
                      <textarea id="cua-text" value={contextualUpdateTextModal} onChange={(e) => setContextualUpdateTextModal(e.target.value)} rows={8} className="input-field text-xs" placeholder="Paste news, guidelines, or other text that might impact an FAS..."/>
                  </div>
                  <div>
                      <label htmlFor="cua-target-fas" className="block font-medium text-slate-700 mb-1">Target FAS Document ID:</label>
                      {knownFasDocumentIdsForCUA.length > 0 ? (
                          <select id="cua-target-fas" value={targetFasForUpdateModal} onChange={(e) => setTargetFasForUpdateModal(e.target.value)} className="input-field text-sm">
                              <option value="">-- Select Target FAS Document --</option>
                              {knownFasDocumentIdsForCUA.map(docId => <option key={docId} value={docId}>{docId}</option>)}
                              <option value="OTHER_MANUAL_INPUT">Manually Enter ID Below</option>
                          </select>
                      ) : null}
                      {(knownFasDocumentIdsForCUA.length === 0 || targetFasForUpdateModal === "OTHER_MANUAL_INPUT" || !knownFasDocumentIdsForCUA.includes(targetFasForUpdateModal)) && (
                        <input 
                            type="text" 
                            id="cua-target-fas-manual" 
                            value={(targetFasForUpdateModal === "OTHER_MANUAL_INPUT" || !knownFasDocumentIdsForCUA.includes(targetFasForUpdateModal)) ? targetFasForUpdateModal : ""} // Clear if dropdown option re-selected
                            onChange={(e) => setTargetFasForUpdateModal(e.target.value)} 
                            className="input-field mt-1 text-sm" 
                            placeholder="e.g., FAS-17.pdf (Must be known to backend)"
                        />
                      )}
                      {knownFasDocumentIdsForCUA.length === 0 && <p className="text-xs text-slate-500 mt-1">No FAS documents active in editor. Type ID manually (must be known to backend).</p>}
                  </div>
              </div>
          </Modal>
      )}
      {activeModal === 'srma_rule_miner' && (
        <SrmaModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          onSubmit={handleMineShariahRules}
          isProcessingSrma={isProcessingSrma}
        />
      )}
    </>
  );
};

export default App;