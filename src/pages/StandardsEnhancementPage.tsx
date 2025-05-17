/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/pages/StandardsEnhancementPage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import FasEditorPage from '../components/FasEditorPage'; // This now becomes the core of this page
import {
    getAssistanceStreamUrl,
} from '../services/api';
import { type ChatMessage, type SSEEventData, type ValidatedSuggestionPackage } from '../types'; // Assuming types.ts

interface StandardsEnhancementPageProps {
  isSystemInitialized: boolean;
  currentSessionId: string | null;
  sendSystemNotification: (message: string, type?: 'info' | 'error' | 'success' | 'warning') => void;
  addMessageToChat?: (sender: ChatMessage['sender'], text?: string, component?: React.ReactNode, isLoadingPlaceholder?: boolean) => string; // If this page needs to log to a global chat
  globalSseControllerRef?: React.RefObject<AbortController | null>;
  addKnownFasDocumentIdForCUA: (docId: string) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const StandardsEnhancementPage: React.FC<StandardsEnhancementPageProps> = ({
  isSystemInitialized,
  currentSessionId,
  sendSystemNotification,
  addMessageToChat,
  globalSseControllerRef, // Use this if cancellation should be global
  addKnownFasDocumentIdForCUA
}) => {
  // State specific to FAS Editing
  const [fasEditorInitialContent, setFasEditorInitialContent] = useState<string>('');
  const [fasEditorDocumentId, setFasEditorDocumentId] = useState<string>('');
  const [fasEditorSuggestions, setFasEditorSuggestions] = useState<ValidatedSuggestionPackage[]>([]);
  const [isFasSuggestionsLoading, setIsFasSuggestionsLoading] = useState<boolean>(false);
  const [suggestionToApplyToEditor, setSuggestionToApplyToEditor] = useState<ValidatedSuggestionPackage | null>(null);
  
  const [isExtractingFasText, setIsExtractingFasText] = useState<boolean>(false);

  const pageSseControllerRef = useRef<AbortController | null>(null); // Page-specific SSE controller

  // Effect to manage document ID for CUA
  useEffect(() => {
    if (fasEditorDocumentId) {
        addKnownFasDocumentIdForCUA(fasEditorDocumentId);
    }
  }, [fasEditorDocumentId, addKnownFasDocumentIdForCUA]);

  const handleFasFileForEditor = useCallback(async (file: File | null) => {
    if (!file) {
      sendSystemNotification("No FAS file selected.", "info");
      setFasEditorInitialContent('');
      setFasEditorDocumentId('');
      return;
    }
    setIsExtractingFasText(true);
    sendSystemNotification(`Extracting text from ${file.name}...`, "info");
    const formData = new FormData(); formData.append('pdf_file', file);
    try {
      let markdownText = ''; let docInfo: any = { filename: file.name };
      // Try Marker first
      try {
        const markerResponse = await axios.post(`${API_BASE_URL}/extract_text_from_pdf_file_marker`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        if (markerResponse.data.status === 'success' && typeof markerResponse.data.extracted_text === 'string') {
          markdownText = markerResponse.data.extracted_text;
          docInfo = markerResponse.data.document_info || { filename: file.name, ...markerResponse.data };
        } else { throw new Error(markerResponse.data.message || "Marker extraction failed"); }
      } catch (markerError) {
        sendSystemNotification(`Marker failed for ${file.name}. Trying fallback...`, "warning");
        const fallbackResponse = await axios.post(`${API_BASE_URL}/extract_text_from_pdf?reformat_ai=true`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        if (fallbackResponse.data.status === 'success' && fallbackResponse.data.pages?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          markdownText = fallbackResponse.data.pages.map((p: { page_number: any; content: string; }) => `<!-- Page ${p.page_number} -->\n${p.content.trim()}`).join('\n\n<hr />\n\n');
          docInfo = fallbackResponse.data.document_info || { filename: file.name, ...fallbackResponse.data };
        } else { throw new Error(fallbackResponse.data.message || "Fallback extraction failed"); }
      }
      const finalDocId = (docInfo && docInfo.filename) ? docInfo.filename : file.name;
      if (!finalDocId || finalDocId.trim() === "") {
          sendSystemNotification(`PDF Processing Error: Could not determine document ID for ${file.name}.`, "error");
          setIsExtractingFasText(false); return;
      }
      sendSystemNotification(`Extraction complete for ${finalDocId}. Editor ready.`, "success");
      setFasEditorInitialContent(markdownText.trimStart());
      setFasEditorDocumentId(finalDocId);
      setFasEditorSuggestions([]); // Clear previous suggestions for new doc
    } catch (e: any) {
      sendSystemNotification(`PDF Processing Failed for FAS Editor: ${e.message}`, "error");
    }
    setIsExtractingFasText(false);
  }, [sendSystemNotification]);

  const startPageSSEProcessing = useCallback(async (
    url: string, payload: any, 
    onEvent: (eventData: SSEEventData) => void, 
    onComplete: () => void, 
    onError: (error: Error) => void
  ) => {
    if (pageSseControllerRef.current) pageSseControllerRef.current.abort(); // Cancel previous page-specific SSE
    const controller = new AbortController();
    pageSseControllerRef.current = controller;

    // Use globalSseControllerRef to allow global cancellation if needed,
    // but prefer pageSseControllerRef for page-specific task management.
    // This example uses pageSseControllerRef primarily.
    // If globalSseControllerRef is used, ensure it doesn't conflict with other page's SSE.
    // For now, let's assume globalSseControllerRef is for tasks NOT handled by a specific page's loader.

    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      if (!response.ok) { const et = await response.text(); throw new Error(`API Error: ${response.status} - ${et}`); }
      if (!response.body) throw new Error("No response body from API.");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let sseBuffer = '';
      
      async function processStream() {
        while (true) {
          try {
            const { done, value } = await reader.read();
            if (controller.signal.aborted) { onError(new Error("Operation cancelled by user.")); break; }
            if (done) { onComplete(); break; }
            sseBuffer += decoder.decode(value, { stream: true });
            const messages = sseBuffer.split('\n\n'); sseBuffer = messages.pop() || '';
            messages.forEach(message => {
              if (message.startsWith('data: ')) {
                try {
                  const eventData = JSON.parse(message.substring(6)) as SSEEventData; onEvent(eventData);
                } catch (e) { console.warn("SSE JSON Parse Error:", e, "Raw:", message); }
              }
            });
          } catch (streamReadError: any) { onError(streamReadError); break; }
        }
      }
      await processStream();
    } catch (error: any) { onError(error); }
    finally {
        if (pageSseControllerRef.current === controller) pageSseControllerRef.current = null;
    }
  }, []);


  const handleGetAIAssistanceForFAS = useCallback((selectedText: string, documentId: string, _markdownContent: string) => {
    if (!selectedText.trim()) { sendSystemNotification("Please select text in the FAS editor to get suggestions.", "info"); return; }
    if (!isSystemInitialized) { sendSystemNotification("System not initialized. AI suggestions may be limited or unavailable.", "warning"); }
    
    setFasEditorSuggestions([]); 
    setIsFasSuggestionsLoading(true);
    sendSystemNotification(`Requesting AI assistance for: "${selectedText.substring(0, 30)}..."`, "info");

    const payload = { selected_text_from_fas: selectedText, fas_document_id: documentId };
    startPageSSEProcessing(
      getAssistanceStreamUrl(), payload,
      (eventData) => { 
        if (eventData.event_type === "validated_suggestion_package" && eventData.payload) {
            setFasEditorSuggestions(prev => [...prev, eventData.payload as ValidatedSuggestionPackage]);
        }
        if (eventData.message && (eventData.event_type === "progress" || eventData.event_type === "system_log")) {
            sendSystemNotification(`AI (FAS Editor): ${eventData.message}`, "info");
        }
        if (eventData.event_type === "fatal_error" || eventData.event_type === "error") {
            sendSystemNotification(`FAS AI Error: ${eventData.message}`, "error");
            setIsFasSuggestionsLoading(false);
            pageSseControllerRef.current?.abort();
        }
      },
      () => { setIsFasSuggestionsLoading(false); sendSystemNotification("FAS AI analysis complete.", "success"); },
      (error) => { 
        setIsFasSuggestionsLoading(false); 
        if (error.message !== "Operation cancelled by user.") {
            sendSystemNotification(`FAS AI Assist Failed: ${error.message}`, "error");
        } else {
            sendSystemNotification("FAS AI assistance cancelled.", "info");
        }
      }
    );
  }, [isSystemInitialized, sendSystemNotification, startPageSSEProcessing]);
  
  const handleAcceptFasEditorSuggestion = useCallback((suggestionToAccept: ValidatedSuggestionPackage) => {
    setSuggestionToApplyToEditor(suggestionToAccept); 
    setFasEditorSuggestions(prev => prev.filter(s => s !== suggestionToAccept)); 
    sendSystemNotification(`Applying suggestion from ${suggestionToAccept.source_agent_name}.`, "info");
  }, [sendSystemNotification]);

  const handleRejectFasEditorSuggestion = useCallback((suggestionToReject: ValidatedSuggestionPackage) => {
    setFasEditorSuggestions(prev => prev.filter(s => s !== suggestionToReject));
    sendSystemNotification(`Suggestion from ${suggestionToReject.source_agent_name} rejected.`, "info");
  }, [sendSystemNotification]);

  const onFasSuggestionAppliedOrDismissedInEditor = useCallback(() => {
    setSuggestionToApplyToEditor(null); 
  }, []);

  const onFasDocumentSaveFromEditor = useCallback((docId: string, _newContent: string, summary: string) => {
    sendSystemNotification(`Version of '${docId}' saved. Summary: "${summary}"`, "success");
    // Logic to refresh version list in FasEditorPage can be triggered here if needed
  }, [sendSystemNotification]);

  // Expose necessary functions to RightSidebar via props or context if it were a child.
  // Since RightSidebar is part of MainLayout, communication would be through App.tsx state changes or callbacks passed to MainLayout.
  // For now, RightSidebar will get `onLoadFas` etc. through MainLayout -> RightSidebar.

  return (
    <div className="h-full flex flex-col">
      {/* Pass necessary props to FasEditorPage. RightSidebar controls will be in MainLayout */}
      <FasEditorPage
        initialContent={fasEditorInitialContent}
        documentId={fasEditorDocumentId}
        sessionId={currentSessionId}
        onGetAIAssistance={handleGetAIAssistanceForFAS}
        onSaveRequest={onFasDocumentSaveFromEditor}
        suggestionToApply={suggestionToApplyToEditor}
        onSuggestionHandled={onFasSuggestionAppliedOrDismissedInEditor}
        onNotify={sendSystemNotification}
        // These are needed for RightSidebar specific to this page
        onLoadFasForEditor={handleFasFileForEditor}
        isExtractingFasText={isExtractingFasText}
        fasEditorSuggestions={fasEditorSuggestions}
        isFasSuggestionsLoading={isFasSuggestionsLoading}
        onAcceptFasEditorSuggestion={handleAcceptFasEditorSuggestion}
        onRejectFasEditorSuggestion={handleRejectFasEditorSuggestion}
        pageSseControllerRef={pageSseControllerRef} // Pass the ref for cancellation
      />
    </div>
  );
};

export default StandardsEnhancementPage;