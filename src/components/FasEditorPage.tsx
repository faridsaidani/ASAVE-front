/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/FasEditorPage.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Edit, Eye, Save, History, MessageSquare, Loader2, BrainCircuit, Scissors, FileSearch2 } from 'lucide-react';
import SuggestionCard from './SuggestionCard';
import Modal from './Modal'; // Assuming Modal is a shared component
import FileUploader from './FileUploader'; // For the initial file load specific to this page
import type { FasVersion, ValidatedSuggestionPackage } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

interface FasEditorPageProps {
  // Props coming from StandardsEnhancementPage (wrapper)
  initialContent: string;
  documentId: string;
  sessionId: string | null;
  onGetAIAssistance: (selectedText: string, documentId: string, currentMarkdown: string) => void;
  onSaveRequest: (documentId: string, newContent: string, summary: string) => void;
  suggestionToApply: ValidatedSuggestionPackage | null;
  onSuggestionHandled: () => void;
  onNotify: (message: string, type?: 'info' | 'error' | 'success' | 'warning') => void;

  // Props that FasEditorPage itself manages and passes to its internal RightSidebar content
  onLoadFasForEditor: (file: File | null) => void;
  isExtractingFasText: boolean;
  fasEditorSuggestions: ValidatedSuggestionPackage[];
  isFasSuggestionsLoading: boolean;
  onAcceptFasEditorSuggestion: (suggestion: ValidatedSuggestionPackage) => void;
  onRejectFasEditorSuggestion: (suggestion: ValidatedSuggestionPackage) => void;
  pageSseControllerRef: React.RefObject<AbortController | null>;
}

const FasEditorPage: React.FC<FasEditorPageProps> = ({
  initialContent, documentId, sessionId,
  onGetAIAssistance, onSaveRequest,
  suggestionToApply, onSuggestionHandled, onNotify,
  // Props for its own "sidebar-like" controls area
  onLoadFasForEditor, isExtractingFasText,
  fasEditorSuggestions, isFasSuggestionsLoading,
  onAcceptFasEditorSuggestion, onRejectFasEditorSuggestion,
  pageSseControllerRef
}) => {
  const [markdownContent, setMarkdownContent] = useState<string>(initialContent);
  const [selectedEditorText, setSelectedEditorText] = useState<string>('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [versions, setVersions] = useState<FasVersion[]>([]);
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [minConfidenceForHighlight, setMinConfidenceForHighlight] = useState<number>(75);

  useEffect(() => { setMarkdownContent(initialContent); }, [initialContent]);

  useEffect(() => {
    const editor = editorRef.current;
    if (viewMode === 'edit' && editor) {
      const updateSelection = () => {
        const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
        setSelectedEditorText(selected.trim() ? selected.trim() : '');
      };
      editor.addEventListener('select', updateSelection);
      editor.addEventListener('keyup', updateSelection);
      editor.addEventListener('mouseup', updateSelection);
      editor.addEventListener('focus', updateSelection);
      return () => {
        editor.removeEventListener('select', updateSelection);
        editor.removeEventListener('keyup', updateSelection);
        editor.removeEventListener('mouseup', updateSelection);
        editor.removeEventListener('focus', updateSelection);
      };
    } else if (viewMode === 'preview') {
        const handlePreviewMouseUp = () => {
            const selection = window.getSelection();
            const selected = selection?.toString().trim();
            if (selected && selection?.anchorNode && editorRef.current?.closest('.fas-editor-content-area')?.contains(selection.anchorNode)) { // Check if selection is within our preview
                setSelectedEditorText(selected);
            }
        };
        document.addEventListener('mouseup', handlePreviewMouseUp);
        return () => document.removeEventListener('mouseup', handlePreviewMouseUp);
    } else {
        setSelectedEditorText('');
    }
  }, [viewMode, markdownContent]);

  useEffect(() => {
    if (suggestionToApply && suggestionToApply.suggestion_details.proposed_text) {
      const original = suggestionToApply.suggestion_details.original_text || selectedEditorText;
      const proposed = suggestionToApply.suggestion_details.proposed_text;
      const currentEditorValue = editorRef.current?.value || markdownContent;
      const startIndex = currentEditorValue.indexOf(original);

      if (startIndex !== -1 && editorRef.current) {
        const newContent = currentEditorValue.substring(0, startIndex) + proposed + currentEditorValue.substring(startIndex + original.length);
        setMarkdownContent(newContent); // Update state for ReactMarkdown
        editorRef.current.value = newContent; // Directly update textarea for immediate visual consistency

        const newCursorPos = startIndex + proposed.length;
        setTimeout(() => { // Ensure focus and selection happen after DOM update
          editorRef.current?.focus();
          editorRef.current?.setSelectionRange(newCursorPos, newCursorPos);
          setSelectedEditorText(proposed); // Update selected text to the newly inserted one
        }, 0);
        onNotify(`Applied suggestion from ${suggestionToApply.source_agent_name}`, 'success');
      } else {
        navigator.clipboard.writeText(proposed);
        onNotify("Original text snippet not found in editor. Proposed text copied to clipboard.", "info");
      }
      onSuggestionHandled();
    }
  }, [suggestionToApply, onSuggestionHandled, selectedEditorText, markdownContent, onNotify]);

  const handleAIAssistClick = () => {
    if (selectedEditorText) onGetAIAssistance(selectedEditorText, documentId, markdownContent);
    else onNotify("Please select text in the editor first to get AI assistance.", "warning");
  };

  const fetchVersions = useCallback(async () => {
    if (!sessionId || !documentId) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/document/${sessionId}/${documentId}/versions`);
      if (response.data.status === 'success') setVersions(response.data.versions || []);
      else onNotify(`Failed to fetch versions: ${response.data.message}`, "error");
    } catch (error: any) { onNotify(`Error fetching versions: ${error.message}`, "error"); }
  }, [sessionId, documentId, onNotify]);

  useEffect(() => { if (sessionId && documentId) fetchVersions(); }, [sessionId, documentId, fetchVersions]);

  const handleSaveCurrentVersion = async () => {
    if (!sessionId || !documentId) { onNotify("Session or document ID missing. Cannot save version.", "error"); return; }
    const summary = prompt("Enter a brief summary for this version:", `Edit at ${new Date().toLocaleTimeString()}`);
    if (summary === null) { onNotify("Save cancelled.", "info"); return; } // User cancelled
    try {
      const response = await axios.post(`${API_BASE_URL}/document/${sessionId}/${documentId}/save_version`, { markdown_content: markdownContent, change_summary: summary });
      if (response.data.status === 'success') {
        onNotify(`Version ${response.data.version_id} saved successfully!`, "success");
        fetchVersions(); // Refresh version list
        onSaveRequest(documentId, markdownContent, summary); // Notify parent
      } else { onNotify(`Failed to save version: ${response.data.message}`, "error"); }
    } catch (error: any) { onNotify(`Error saving version: ${error.response?.data?.message || error.message}`, "error"); }
  };
  
  const handleRevertToVersion = async (versionId: string) => {
    if (!sessionId || !documentId) { onNotify("Cannot revert: Session/Doc ID missing.", "error"); return; }
    if (!window.confirm(`Are you sure you want to revert to version ${versionId}? Current unsaved changes will be backed up.`)) return;
    try {
      const response = await axios.post(`${API_BASE_URL}/document/${sessionId}/${documentId}/revert_to_version`, { version_id_to_revert_to: versionId });
      if (response.data.status === 'success') {
        setMarkdownContent(response.data.reverted_markdown_content);
        onNotify(`Successfully reverted to version ${versionId}.`, "success");
        fetchVersions(); // Refresh list
        setShowVersionsModal(false);
      } else { onNotify(`Failed to revert: ${response.data.message}`, "error"); }
    } catch (error: any) { onNotify(`Error reverting: ${error.response?.data?.message || error.message}`, "error"); }
  };

  const highlightedFasSuggestionId = useMemo(() => {
    if (!fasEditorSuggestions.length) return null;
    let highestConfidence = -1;
    let bestSuggestion: ValidatedSuggestionPackage | null = null;
    fasEditorSuggestions.forEach(sugg => {
        const score = sugg.suggestion_details.confidence_score ?? 0;
        if (score >= minConfidenceForHighlight && score > highestConfidence) {
            highestConfidence = score;
            bestSuggestion = sugg;
        }
    });
    return bestSuggestion ? `${bestSuggestion.source_agent_name}-${bestSuggestion.suggestion_details.proposed_text.slice(0,20)}` : null;
  }, [fasEditorSuggestions, minConfidenceForHighlight]);

  return (
    <div className="h-full flex"> {/* Main container for editor and its sidebar */}
        {/* Editor Area */}
        <div className="flex-grow p-4 flex flex-col bg-white overflow-hidden fas-editor-content-area">
            {!documentId && (
                 <div className="flex-grow flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-lg">
                    <FileSearch2 size={48} className="text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">FAS Document Editor</h3>
                    <p className="text-sm text-slate-500 mb-4">Load a FAS PDF to begin editing and get AI-powered enhancement suggestions.</p>
                    <FileUploader
                        label=""
                        accept=".pdf"
                        onFilesUploaded={(files) => onLoadFasForEditor(files as File)}
                        id="fas-editor-page-uploader"
                    />
                     {isExtractingFasText && <div className="mt-2 text-sm text-sky-600 flex items-center"><Loader2 size={16} className="animate-spin mr-2"/>Extracting PDF content...</div>}
                </div>
            )}
            {documentId && (
                <>
                    <h2 className="text-lg font-semibold text-slate-700 mb-2 shrink-0">
                        Editing: <span className="font-mono text-sky-600">{documentId}</span>
                        {sessionId && <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">Session: {sessionId}</span>}
                    </h2>
                    <div className="mb-2 space-x-2 shrink-0 flex items-center">
                        <button onClick={() => setViewMode('edit')} className={`btn-toggle ${viewMode === 'edit' ? 'btn-toggle-active' : ''}`}><Edit size={14}/> Edit</button>
                        <button onClick={() => setViewMode('preview')} className={`btn-toggle ${viewMode === 'preview' ? 'btn-toggle-active' : ''}`}><Eye size={14}/> Preview</button>
                        <button onClick={handleSaveCurrentVersion} className="btn-secondary-small"><Save size={14}/> Save Version</button>
                        <button onClick={() => {fetchVersions(); setShowVersionsModal(true);}} className="btn-secondary-small"><History size={14}/> Versions ({versions.length})</button>
                        <button onClick={handleAIAssistClick} className="btn-primary-small" disabled={!selectedEditorText || isFasSuggestionsLoading}>
                            {isFasSuggestionsLoading ? <Loader2 size={14} className="animate-spin"/> : <MessageSquare size={14}/>} Get Suggestions
                        </button>
                        {selectedEditorText && viewMode === 'edit' && <button onClick={() => setSelectedEditorText('')} className="btn-secondary-small !p-1" title="Clear Selection"><Scissors size={12}/></button>}
                    </div>
                    {selectedEditorText && viewMode === 'edit' && (
                        <div className="p-1.5 my-1 bg-sky-50 border border-sky-200 rounded-md text-xs shrink-0">
                            <p className="font-medium text-sky-700">Selected for AI:</p>
                            <pre className="bg-white p-1 rounded max-h-16 overflow-y-auto text-[11px]"><code>{selectedEditorText}</code></pre>
                        </div>
                    )}
                    <div className="flex-grow min-h-0 mt-2">
                        {viewMode === 'edit' ? (
                            <textarea ref={editorRef} value={markdownContent} onChange={(e) => setMarkdownContent(e.target.value)} className="w-full h-full textarea-field text-sm font-mono resize-none p-2"/>
                        ) : (
                            <div className="w-full h-full markdown-preview p-3 border rounded bg-slate-50 text-sm overflow-y-auto scrollbar-thin">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownContent || "No content to preview."}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                </>
            )}
            {showVersionsModal && (
                <Modal title={`Versions for: ${documentId}`} onClose={() => setShowVersionsModal(false)} size="large">
                    {versions.length > 0 ? (
                        <ul className="space-y-1.5 text-xs max-h-96 overflow-y-auto">
                            {versions.map((v) => (
                                <li key={v.version_id} className="p-2 border rounded-md flex justify-between items-center hover:bg-slate-50">
                                    <div>
                                        <p><strong>ID:</strong> <span className="font-mono">{v.version_id}</span></p>
                                        <p className="text-[10px] text-slate-500">Saved: {new Date(v.timestamp).toLocaleString()}</p>
                                        <p className="text-[10px] italic mt-0.5">"{v.summary || "No summary"}"</p>
                                    </div>
                                    <button onClick={() => handleRevertToVersion(v.version_id)} className="btn-secondary-small text-[10px] px-1.5 py-0.5">Revert to this</button>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-slate-500 italic">No versions found for this document in the current session.</p>}
                </Modal>
            )}
        </div>

        {/* Mini Sidebar for FAS Editor Suggestions */}
        {documentId && (
            <div className="w-80 border-l border-slate-300 bg-slate-50 p-3 flex flex-col space-y-2 overflow-y-auto scrollbar-thin shrink-0">
                <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-slate-700 flex items-center">
                        <BrainCircuit size={16} className="mr-1.5 text-purple-600"/> AI Suggestions
                    </p>
                    {pageSseControllerRef.current && (
                         <button onClick={() => pageSseControllerRef.current?.abort()} className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded">Cancel</button>
                    )}
                </div>
                 <div className="flex items-center text-xs text-slate-600 border p-1.5 rounded-md bg-white">
                    <label htmlFor="confidenceThreshold" className="mr-1.5 font-medium">Min. Confidence for Highlight:</label>
                    <input type="number" id="confidenceThresholdEditor" value={minConfidenceForHighlight} onChange={e => setMinConfidenceForHighlight(parseInt(e.target.value,10) || 0)} min="0" max="100" step="5" className="w-14 input-field px-1 py-0.5 text-[11px] text-center"/>
                    <span className="ml-1">%</span>
                </div>
                {isFasSuggestionsLoading && <div className="flex justify-center py-4"><Loader2 size={24} className="animate-spin text-purple-500"/> <span className="ml-2 text-sm text-slate-500">Loading...</span></div>}
                {!isFasSuggestionsLoading && fasEditorSuggestions.length === 0 && <p className="text-xs text-slate-400 italic py-4 text-center">No suggestions available. Select text and click "Get Suggestions".</p>}
                {fasEditorSuggestions.length > 0 && (
                            <div className="space-y-2 pt-1">
                                {fasEditorSuggestions.map((sugg, idx) => (
                                    <SuggestionCard // This card is now more detailed when expanded
                                        key={`${sugg.source_agent_name}-${idx}-${sugg.suggestion_details.proposed_text.slice(0,10)}`}
                                        suggestionPackage={sugg}
                                        onAccept={() => onAcceptFasEditorSuggestion(sugg)}
                                        onReject={() => onRejectFasEditorSuggestion(sugg)}
                                        isHighlighted={highlightedFasSuggestionId === `${sugg.source_agent_name}-${sugg.suggestion_details.proposed_text.slice(0,20)}`}
                                    />
                                ))}
                            </div>
                )}
            </div>
        )}
    </div>
  );
};

export default FasEditorPage;