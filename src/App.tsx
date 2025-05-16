/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import FileUploader from './components/FileUploader';
import Sidebar from './components/Sidebar';
import {
    initializeSystem,
    getAssistanceStreamUrl,
    getApiStatus,
    type InitResponse,
    type SSEEventData,
    type ValidatedSuggestionPackage
} from './services/api';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Settings, AlertCircle, CheckCircle, Info, FileText,
    MessageSquare, Edit3, Loader2, Scissors, Eye, Edit, // Lucide icons
    AlertTriangle
} from 'lucide-react';

// --- Type Definitions for API Responses ---
interface MarkerImageInfo {
    image_path?: string; // Original path from Marker
    saved_to?: string;   // Server local path (frontend can't use directly)
    web_url?: string;    // THIS IS WHAT WE NEED from backend for display
    format?: string | null;
    error?: string;
}

interface MarkerApiResponse { // For /extract_text_from_pdf_file_marker
    status: "success" | "error";
    message: string;
    filename?: string;
    extracted_text?: string; // This is the Markdown from Marker (potentially with updated image URLs)
    images?: MarkerImageInfo[] | string; // string if "No images found"
    document_info?: { // For consistency if a fallback also provides this
        filename: string;
        page_count?: number | string;
        source?: string; // e.g., "Marker AI"
    };
}

// For a potential fallback extraction method
interface FallbackPageContent {
  page_number: number;
  content_type: string; // e.g., "markdown_reformatted"
  content: string;
  reformat_notes?: string;
}
interface FallbackExtractedPdfResponse {
  status: "success" | "error";
  message: string;
  document_info?: { filename: string; page_count?: number | string; ai_reformatting_applied?: boolean };
  pages?: FallbackPageContent[];
}


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

const App: React.FC = () => {
  // --- Initialization State (for backend vector stores) ---
  const [fasFilesForInit, setFasFilesForInit] = useState<FileList | null>(null);
  const [ssFilesForInit, setSsFilesForInit] = useState<FileList | null>(null);
  const [rulesFileForInit, setRulesFileForInit] = useState<File | null>(null);
  const [isSystemInitialized, setIsSystemInitialized] = useState<boolean>(false);
  
  // --- Document Text State ---
  const [fasFileForViewing, setFasFileForViewing] = useState<File | null>(null);
  const [currentMarkdownContent, setCurrentMarkdownContent] = useState<string>('');
  const [currentDocumentId, setCurrentDocumentId] = useState<string>(''); // Filename of the viewed/edited FAS
  const [selectedText, setSelectedText] = useState<string>('');
  const markdownEditorRef = useRef<HTMLTextAreaElement>(null);
  const markdownPreviewRef = useRef<HTMLDivElement>(null); // Ref for preview pane selection
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview'); 

  // --- API Interaction State ---
  const [progressLog, setProgressLog] = useState<SSEEventData[]>([]);
  const [finalSuggestions, setFinalSuggestions] = useState<ValidatedSuggestionPackage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false); 
  const [isExtractingText, setIsExtractingText] = useState<boolean>(false);
  const [apiMessage, setApiMessage] = useState<{type: 'info' | 'success' | 'error' | 'warning', text: string} | null>(null);
  const sseControllerRef = useRef<AbortController | null>(null);

  // Check API status on initial load
  useEffect(() => {
    const checkInitialApiStatus = async () => {
      try {
        const statusData = await getApiStatus();
        if (statusData?.asave_initialized) {
          setIsSystemInitialized(true);
          setApiMessage({type: 'info', text: 'ASAVE backend system previously initialized.'});
        } else {
          setApiMessage({type: 'info', text: 'ASAVE backend needs initialization for full context features.'});
        }
      } catch (error) {
        setApiMessage({type: 'error', text: 'Could not connect to ASAVE API. Ensure backend is running.'});
      }
    };
    checkInitialApiStatus();
  }, []);

  const handleInitializeBackend = async () => {
    if (!fasFilesForInit || fasFilesForInit.length === 0) {
      setApiMessage({type: 'error', text: "Please upload FAS PDF(s) for backend knowledge base."});
      return;
    }
    setIsLoading(true); // Use general isLoading or a specific one
    setApiMessage({type: 'info', text: 'Initializing backend knowledge base... This may take a moment.'});
    const formData = new FormData();
    
    Array.from(fasFilesForInit).forEach(file => formData.append('fas_files', file, file.name));
    if (ssFilesForInit) {
      Array.from(ssFilesForInit).forEach(file => formData.append('ss_files', file, file.name));
    }
    if (rulesFileForInit) {
      formData.append('shariah_rules_explicit_file', rulesFileForInit, rulesFileForInit.name);
    }

    try {
      const data: InitResponse = await initializeSystem(formData);
      setApiMessage({type: data.status === 'success' ? 'success' : 'error', text: `Backend Init ${data.status}: ${data.message}`});
      if (data.status === 'success') {
        setIsSystemInitialized(true);
      }
    } catch (error: any) {
      setApiMessage({type: 'error', text: `Backend Init Failed: ${error.message || 'Unknown error'}`});
    }
    setIsLoading(false);
  };

  const handleFasFileForProcessing = async (file: File | null) => {
    setFasFileForViewing(file); // Store the original File object
    if (file) {
      setIsExtractingText(true);
      setApiMessage({type: 'info', text: `Processing ${file.name} for Markdown content...`});
      setCurrentMarkdownContent('');
      setCurrentDocumentId(file.name);
      setSelectedText('');
      setFinalSuggestions([]);
      setProgressLog([]);

      const formData = new FormData();
      formData.append('pdf_file', file);

      try {
        setApiMessage({type: 'info', text: `Attempting extraction with Marker AI for ${file.name}...`});
        const response = await axios.post<MarkerApiResponse>(`${API_BASE_URL}/extract_text_from_pdf_file_marker`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (response.data.status === 'success' && typeof response.data.extracted_text === 'string') {
          setCurrentMarkdownContent(response.data.extracted_text);
          // Ensure the backend rewrites image paths in `extracted_text` to be web-accessible URLs
          // For example, `![](./output/img.png)` should become `![](http://localhost:5001/served_images/unique_id/img.png)`
          setApiMessage({type: 'success', text: `Successfully extracted Markdown using Marker AI from ${response.data.filename}.`});
        } else {
          setApiMessage({type: 'warning', text: `Marker AI extraction issues (${response.data.message}). Attempting fallback...`});
          // Fallback to your other extraction route (e.g., /extract_text_from_pdf)
          // This route should also return Markdown, possibly via TextReformatterAgent
          const fallbackResponse = await axios.post<FallbackExtractedPdfResponse>(`${API_BASE_URL}/extract_text_from_pdf?reformat_ai=true`, formData, {
             headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (fallbackResponse.data.status === 'success' && fallbackResponse.data.pages && fallbackResponse.data.pages.length > 0) {
            const allMarkdown = fallbackResponse.data.pages
              .map(p => `<!-- Page ${p.page_number} / ${fallbackResponse.data.document_info?.page_count} -->\n\n${p.content.trim()}`)
              .join('\n\n<hr class="my-4 border-slate-300"/>\n\n'); // Page separator
            setCurrentMarkdownContent(allMarkdown.trimStart());
            const reformatStatus = fallbackResponse.data.document_info?.ai_reformatting_applied ? "AI reformatting applied." : "Raw text extracted.";
            setApiMessage({type: 'success', text: `Fallback extraction successful for ${fallbackResponse.data.document_info?.filename}. ${reformatStatus}`});
          } else {
            throw new Error(fallbackResponse.data.message || "Fallback extraction also failed.");
          }
        }
      } catch (error: any) {
        console.error("Error during PDF processing (Marker or Fallback):", error);
        setCurrentMarkdownContent('');
        const errMsg = error.response?.data?.message || error.message || "Unknown error during PDF processing.";
        setApiMessage({type: 'error', text: `PDF Processing Failed: ${errMsg}`});
      }
      setIsExtractingText(false);
    } else {
      setCurrentMarkdownContent('');
      setCurrentDocumentId('');
      setFasFileForViewing(null); // Clear the file object if "null" is passed (e.g. user clears selection)
    }
  };


  // Attach selection listeners based on viewMode
  useEffect(() => {
    const editor = markdownEditorRef.current;
    const previewArea = markdownPreviewRef.current;

    if (viewMode === 'edit' && editor) {
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
    } else if (viewMode === 'preview' && previewArea) {
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
  }, [viewMode]);


  const clearCurrentSelection = () => {
    setSelectedText('');
    window.getSelection()?.empty(); // Try to clear browser's visual selection
    if (markdownEditorRef.current && viewMode === 'edit') {
        const start = markdownEditorRef.current.selectionStart;
        markdownEditorRef.current.setSelectionRange(start, start); // Collapse selection
    }
  };

  const handleGetAIAssistance = async () => {
    if (!selectedText.trim()) {
      setApiMessage({type: 'error', text: "Please select text from the document to get AI suggestions."});
      return;
    }
    // ... (Rest of SSE logic from previous full App.tsx) ...
    setIsLoading(true);
    setProgressLog([{event_type: "system_log", message: "🚀 Requesting AI assistance...", step_code: "STREAM_REQUEST_START"}]);
    setFinalSuggestions([]);
    setApiMessage({type: 'info', text: 'AI is thinking... Please wait. 🧠'});

    if (sseControllerRef.current) sseControllerRef.current.abort();
    const controller = new AbortController();
    sseControllerRef.current = controller;

    const payload = {
      selected_text_from_fas: selectedText,
      fas_document_id: currentDocumentId,
    };

    try {
      const response = await fetch(getAssistanceStreamUrl(), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal,
      });
      if (!response.ok) throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      if (!response.body) throw new Error("ReadableStream not supported or no response body.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      
      async function processStream() {
         
        while (true) {
          try {
            const { done, value } = await reader.read();
            if (controller.signal.aborted) { break; }
            if (done) {
              setProgressLog(p => [...p, {event_type: "system_log", message: "✅ Stream finished by server.", step_code:"STREAM_SERVER_END"}]);
              setIsLoading(false);
              setApiMessage(prev => (prev?.text.includes('AI is thinking') || !prev) ? {type: 'success', text: 'AI analysis complete!'} : prev);
              break;
            }
            sseBuffer += decoder.decode(value, { stream: true });
            const messages = sseBuffer.split('\n\n');
            sseBuffer = messages.pop() || ''; 
            messages.forEach(message => {
              if (message.startsWith('data: ')) {
                try {
                  const eventData = JSON.parse(message.substring(6)) as SSEEventData;
                  setProgressLog(p => [...p, eventData]);
                  if (eventData.event_type === "validated_suggestion_package" && eventData.payload) {
                    setFinalSuggestions(p => [...p, eventData.payload as ValidatedSuggestionPackage]);
                  }
                  if (eventData.event_type === "fatal_error") { /* ... */ }
                  if (eventData.message && eventData.event_type === "progress") {
                    setApiMessage({type: 'info', text: `AI: ${eventData.message}`});
                  }
                } catch (e) { console.warn("Error parsing SSE JSON:", e, "Raw:", message); }
              }
            });
          } catch (streamReadError: any) { 
            if (streamReadError.name !== 'AbortError') {
                console.error("Error reading from stream:", streamReadError);
                setProgressLog(p => [...p, {event_type: "system_log", message: `Stream read error: ${streamReadError.message}`, step_code:"STREAM_READ_ERROR"}]);
                setApiMessage({type: 'error', text: `Stream error: ${streamReadError.message}`});
            }
            setIsLoading(false); break; 
          }
        }
      }
      processStream();
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Error initiating assistance stream:", error);
        setApiMessage({type: 'error', text: `Failed to get AI assistance: ${error.message}`});
        setProgressLog(p => [...p, {event_type: "error", message: `Request initiation failed: ${error.message}`, step_code:"STREAM_REQUEST_FAIL"}]);
      } else {
        setApiMessage({type: 'info', text: 'AI assistance request cancelled.'});
      }
      setIsLoading(false);
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
    setFinalSuggestions(prev => prev.filter(s => s !== suggestionPackageToAccept));
  };

  const handleRejectSuggestion = (suggestionPackageToReject: ValidatedSuggestionPackage) => {
    setApiMessage({type:'info', text: `Suggestion from ${suggestionPackageToReject.source_agent_name} rejected.`});
    setFinalSuggestions(prev => prev.filter(s => s !== suggestionPackageToReject));
  };


  return (
    <div className="app-container flex flex-col lg:flex-row h-screen max-h-screen bg-slate-100 text-slate-800">
      {/* Left Panel: Controls and Text Editor/Viewer */}
      <main className="main-content flex-grow p-4 sm:p-6 space-y-6 overflow-y-auto">
        <header className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl lg:text-3xl font-bold text-sky-700 flex items-center">
            <Edit3 size={30} className="mr-3 text-sky-600" /> ASAVE Text-Based Assistant
          </h1>
          {isLoading && (
            <button 
              onClick={() => {
                sseControllerRef.current?.abort();
                setIsLoading(false); // Manually set loading false on cancel
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
            <div className={`p-3 rounded-md text-sm mb-4 shadow flex items-start ${
            apiMessage.type === 'success' ? 'bg-green-100 text-green-700 border-l-4 border-green-500' :
            apiMessage.type === 'error' ? 'bg-red-100 text-red-700 border-l-4 border-red-500' : 
            apiMessage.type === 'warning' ? 'bg-yellow-100 text-yellow-700 border-l-4 border-yellow-500' :
            'bg-sky-100 text-sky-700 border-l-4 border-sky-500'
          }`}>
            {apiMessage.type === 'success' && <CheckCircle size={20} className="mr-2 flex-shrink-0" />}
            {apiMessage.type === 'error' && <AlertCircle size={20} className="mr-2 flex-shrink-0" />}
            {apiMessage.type === 'warning' && <AlertTriangle size={20} className="mr-2 flex-shrink-0" />}
            {apiMessage.type === 'info' && <Info size={20} className="mr-2 flex-shrink-0" />}
            <span className="flex-grow">{apiMessage.text}</span>
          </div>
        )}

        {/* Section 1: System Initialization (for backend vector stores) */}
        <section className="bg-white p-5 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold text-slate-700 flex items-center">
            <Settings size={20} className="mr-2 text-sky-600"/>1. System Setup
          </h2>
          <div>
            <h3 className="text-md font-medium text-slate-600 mb-2">Initialize Backend Knowledge Base:</h3>
            <p className="text-xs text-slate-500 mb-3">Upload FAS/SS PDFs to create vector stores for AI context retrieval. This is done once or when standards update.</p>
            <FileUploader
              label="FAS PDF(s) for Backend"
              accept=".pdf"
              multiple={true}
              onFilesUploaded={(files) => {
                if (files instanceof FileList || files === null) {
                  setFasFilesForInit(files);
                }
              }}
              id="fas-init-uploader"
            />
            <FileUploader
              label="SS PDF(s) for Backend"
              accept=".pdf"
              multiple={true}
              onFilesUploaded={(files) => {
                if (files instanceof FileList || files === null) {
                  setSsFilesForInit(files);
                }
              }}
              id="ss-init-uploader"
            />
            <FileUploader label="Explicit Rules JSON (Optional)" accept=".json" onFilesUploaded={(file) => setRulesFileForInit(file as File)} id="rules-init-uploader" />
            <button onClick={handleInitializeBackend} disabled={isLoading || !fasFilesForInit} className="w-full mt-3 py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-md shadow-sm disabled:bg-slate-400 transition-colors">
              {(isLoading && apiMessage?.text.includes('Initializing backend')) ? <Loader2 className="inline mr-2 h-4 w-4 animate-spin"/> : '🚀 '}
              Initialize Backend DBs
            </button>
             {isSystemInitialized && <p className="text-xs text-green-600 mt-2 flex items-center"><CheckCircle size={14} className="mr-1"/> Backend knowledge base is initialized.</p>}
          </div>
        </section>

        {/* Section 2: FAS Text Extraction and Editing */}
        <section className="bg-white p-5 rounded-lg shadow space-y-4">
            <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center">
                <FileText size={20} className="mr-2 text-sky-600"/>2. Load, View & Edit FAS Document
            </h2>
            <FileUploader 
                label="Select FAS PDF to Extract Markdown" 
                accept=".pdf" 
                onFilesUploaded={(file) => handleFasFileForProcessing(file as File)} 
                id="fas-marker-uploader" 
            />
            
            {currentDocumentId && <p className="text-sm text-slate-600 my-2">Editing: <strong className="font-semibold">{currentDocumentId}</strong></p>}
            
            {/* View Mode Toggle */}
            {currentMarkdownContent && (
                <div className="my-3">
                    <span className="text-sm font-medium text-slate-700 mr-3">View Mode:</span>
                    <div className="inline-flex rounded-md shadow-sm" role="group">
                        <button type="button" onClick={() => setViewMode('edit')} className={`px-3 py-1.5 text-xs font-medium rounded-l-lg ${viewMode === 'edit' ? 'bg-sky-600 text-white z-10 ring-1 ring-sky-500' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'}`}>
                            <Edit size={14} className="inline mr-1"/> Edit Raw
                        </button>
                        <button type="button" onClick={() => setViewMode('preview')} className={`px-3 py-1.5 text-xs font-medium rounded-r-lg ${viewMode === 'preview' ? 'bg-sky-600 text-white z-10 ring-1 ring-sky-500' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 border-l-0'}`}>
                            <Eye size={14} className="inline mr-1"/> Preview
                        </button>
                    </div>
                </div>
            )}

            {/* Conditional Rendering based on viewMode */}
            {viewMode === 'edit' ? (
                <textarea
                    ref={markdownEditorRef}
                    value={currentMarkdownContent}
                    onChange={(e) => setCurrentMarkdownContent(e.target.value)}
                    placeholder={isExtractingText ? "Extracting & converting PDF, please wait..." : "Extracted Markdown will appear here. Edit or select text."}
                    className="w-full min-h-[60vh] p-3 border border-slate-300 rounded-md shadow-inner text-sm leading-relaxed focus:ring-2 focus:ring-sky-500 focus:border-sky-500 font-mono"
                    disabled={isExtractingText}
                />
            ) : ( // Preview Mode
                <div 
                    ref={markdownPreviewRef} // Ref for the rendered Markdown container
                    className="markdown-preview p-4 border border-slate-300 rounded-md bg-white min-h-[60vh] prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none prose-headings:text-sky-800 prose-a:text-sky-600 hover:prose-a:text-sky-700"
                    // Added Tailwind prose classes for better default Markdown styling
                >
                    {isExtractingText ? 
                        <div className="flex flex-col items-center justify-center h-40 text-slate-500"><Loader2 className="animate-spin text-sky-600 mb-2" size={24}/><p>Loading preview...</p></div> :
                     currentMarkdownContent ? 
                        <ReactMarkdown remarkPlugins={[remarkGfm]} 
                            // Ensure ReactMarkdown doesn't sanitize away your intended HTML (like <hr>)
                            // By default, it's quite safe. For custom HTML, use rehypeRaw.
                        >
                            {currentMarkdownContent}
                        </ReactMarkdown> :
                        <p className="text-slate-500 italic text-center py-10">No content to preview. Upload and process a PDF using the 'Load & Edit' section.</p>
                    }
                     {currentMarkdownContent && !isExtractingText && ( // Show image note only if there's content
                        <p className="mt-6 text-xs text-amber-700 bg-amber-100 p-3 rounded border border-amber-300 flex items-start">
                            <AlertTriangle size={20} className="inline mr-2 flex-shrink-0 text-amber-500"/>
                            <span>
                                <strong>Image Display Note:</strong> Images referenced in this Markdown (e.g., <code>![](_page_X_Figure_Y.jpeg)</code>) are based on paths from the Marker AI tool. For these to display correctly, the backend API must: <br/>
                                1. Save these images to a web-accessible static folder. <br/>
                                2. Rewrite the image paths within this Markdown to be valid web URLs pointing to those saved images (e.g., <code>{`${API_BASE_URL}/marker_images_static/UNIQUE_PDF_ID/image.jpeg`}</code>). <br/>
                                Currently, such images will appear broken if paths are not web-accessible.
                            </span>
                        </p>
                     )}
                </div>
            )}


            {selectedText && ( // Show selection tools only if text is selected
                <div className="mt-4 p-3 bg-sky-50 border border-sky-200 rounded-md">
                    <p className="text-sm font-medium text-sky-700">Selected Text for AI Assistance:</p>
                    <pre className="text-xs text-slate-700 my-1 p-2 bg-white border rounded max-h-24 overflow-y-auto whitespace-pre-wrap"><code>{selectedText}</code></pre>
                    <div className="flex items-center space-x-2 mt-2">
                        <button 
                            onClick={handleGetAIAssistance} 
                            disabled={isLoading || !selectedText.trim()}
                            className="py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-md shadow-sm disabled:bg-slate-400 transition-colors flex-grow flex items-center justify-center"
                        >
                           {(isLoading && !apiMessage?.text.includes('Initializing backend')) ? <Loader2 className="inline mr-2 h-4 w-4 animate-spin"/> : <MessageSquare size={16} className="mr-2"/>}
                           Get AI Suggestions
                        </button>
                        <button onClick={clearCurrentSelection} title="Clear selection" className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md shadow-sm">
                            <Scissors size={16}/>
                        </button>
                    </div>
                </div>
            )}
             {!fasFileForViewing && !isExtractingText && <p className="text-xs text-slate-500 mt-1 text-center py-4">Upload an FAS PDF above to extract its text for editing and AI assistance.</p>}
        </section>
      </main>

      <Sidebar
        progressLog={progressLog}
        suggestions={finalSuggestions}
        onAcceptSuggestion={handleAcceptSuggestion}
        onRejectSuggestion={handleRejectSuggestion}
        isLoading={isLoading && !apiMessage?.text.includes('Initializing backend')}
        className="w-full md:w-[450px] md:min-w-[400px] lg:w-[500px] lg:min-w-[450px] h-screen md:max-h-screen overflow-y-auto" 
      />
    </div>
  );
};

export default App;