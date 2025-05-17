/* eslint-disable @typescript-eslint/no-explicit-any */
// src/types.ts
// (This file would contain all shared type definitions from your App_v2.tsx and api.ts)
// For brevity, I'm showing a few key ones. Ensure you consolidate all relevant types here.

export interface InitResponse {
  status: string;
  message: string;
  fas_vector_store_status?: string;
  ss_vector_store_status?: string;
  num_aisga_variants?: number;
  num_specialized_agents?: number;
  session_id?: string;
}

export interface ApiStatusResponse {
  service_status: string;
  asave_initialized: boolean;
  current_session_id?: string;
  config?: {
    google_api_key_set?: boolean;
    [key: string]: any;
  };
  components_loaded?: {
    [key: string]: boolean | number;
  };
}

export interface SuggestionDetails {
    original_text: string;
    proposed_text: string;
    change_type: string;
    reasoning: string;
    shariah_notes: string;
    prompt_details_actual?: any;
    confidence_score?: number;
}


export interface LibraryPdfItem {
  name: string;
  type: "file" | "directory";
  path?: string; // For files within directories: "dirname/filename.pdf"
  files?: string[]; // For directories
}

export interface SessionInfo {
  session_id: string;
  path: string;
  has_fas_db: boolean;
  has_ss_db: boolean;
  last_modified: string;
}

export type MessageSender = 'user' | 'ai' | 'system';
export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text?: string;
  component?: React.ReactNode;
  timestamp: Date;
  sseEvent?: SSEEventData;
  isLoading?: boolean;
}

export type ModalType = null | 'init_system' | 'contextual_update_input' | 'srma_rule_miner';
// Page-specific modals like contract input will be handled by those pages.

// Contract Suite Specific Types
export interface ClientClauseInput {
    clause_id: string;
    text: string;
}
export interface ClauseValidationPayload {
    clause_id: string;
    original_text: string;
    scva_report: any; 
}
export interface ClauseAiSuggestionPayload extends ValidatedSuggestionPackage {
    clause_id: string;
}
export interface ClauseAnalysisResult {
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

// FAS Editor Specific Types
export interface FasVersion {
  version_id: string;
  timestamp: string;
  summary: string;
  content_filepath_relative?: string; // If backend provides it
}


/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

export interface InitResponse {
  status: string;
  message: string;
  fas_vector_store_status?: string;
  ss_vector_store_status?: string;
  num_aisga_variants?: number;
  num_specialized_agents?: number;
  session_id?: string; // Ensure backend sends this
}

export interface ApiStatusResponse {
  service_status: string;
  asave_initialized: boolean;
  current_session_id?: string; // Backend should provide this
  config?: {
    google_api_key_set?: boolean;
    [key: string]: any;
  };
  components_loaded?: {
    [key: string]: boolean | number;
  };
}

export interface SuggestionDetails {
    original_text: string;
    proposed_text: string;
    change_type: string;
    reasoning: string;
    shariah_notes: string;
    prompt_details_actual?: any; // Contains info about the prompt sent to LLM
    confidence_score?: number; // Self-assessed by AISGA
}

export interface ValidatedSuggestionPackage {
  source_agent_type: string;
  source_agent_name: string;
  suggestion_details: SuggestionDetails;
  scva_report: any; // Define more specific types if possible (Shari'ah Compliance Validation Agent report)
  iscca_report: any; // Define more specific types if possible (Inter-Standard Consistency Check Agent report)
  validation_summary_score: string; // e.g., "SCVA: Compliant, ISCCA: Consistent"
}

// Define FullContractReviewReport structure based on backend's ValidationAgent.review_entire_contract
export interface FullContractReviewReport {
    overall_contract_assessment: string;
    contract_summary_by_ai: string;
    identified_clauses_with_issues: Array<{
        original_clause_text_snippet: string;
        issue_or_concern: string;
        relevant_shariah_rule_ids?: string[];
        recommended_action_or_modification: string;
        severity: "High - Clear Non-Compliance" | "Medium - Potential Risk/Ambiguity" | "Low - Suggestion for Enhancement" | "Information" | string;
    }>;
    general_recommendations?: string[];
    overall_shariah_alignment_notes: string;
    error?: string; // In case the review itself had an issue
    debug_info?: any;
}


export interface SSEEventData {
  event_type: 
    | "system_log" 
    | "progress" 
    | "agent_suggestion_generated" // From old AISGA
    | "validated_suggestion_package" // From old AISGA pipeline, now for FAS editor
    | "warning" 
    | "error" 
    | "fatal_error" 
    | "final_summary"
    // Contract Suite Specific Events
    | "clause_processing_start"
    | "clause_validation_result"      // Original client clause SCVA result
    | "clause_ai_suggestion_generated"// AISGA suggestion for a client clause (already validated by SCVA)
    | "clause_processing_end"
    | "full_contract_review_completed" // For the entire contract review
    | string; // Allow other string types for flexibility
  message?: string; 
  step_code?: string;
  agent_name?: string;
  payload?: any | ValidatedSuggestionPackage | FullContractReviewReport | { total_validated_suggestions: number } | { clause_id: string; [key: string]: any };
}


export const initializeSystem = async (formData: FormData): Promise<InitResponse> => {
  try {
    const response = await axios.post<InitResponse>(`${API_BASE_URL}/initialize`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    console.error("Error initializing system:", error.response?.data || error.message);
    throw error.response?.data || new Error("Network or initialization error");
  }
};

export const getAssistanceStreamUrl = (): string => `${API_BASE_URL}/get_assistance_stream`; // Used by FAS Editor

export const getApiStatus = async (): Promise<ApiStatusResponse> => {
    try {
        const response = await axios.get<ApiStatusResponse>(`${API_BASE_URL}/status`);
        return response.data;
    } catch (error: any) {
        console.error("Error fetching API status:", error.response?.data || error.message);
        throw error.response?.data || new Error("Network or status fetch error");
    }
};

// Contextual Update Agent API call
interface CuaAnalysisPayload {
    new_context_text: string;
    target_document_id: string; // ID for backend to fetch content
    // OR target_document_content: string; // if frontend sends content
}
interface CuaAnalysisResponse {
    status: 'success' | 'error';
    message?: string;
    analysis?: { // Structure based on ContextualUpdateAgent output
        summary_of_new_context: string;
        potential_impact_areas: Array<{
            fas_excerpt_guess: string;
            reason_for_impact: string;
            suggested_action_type: string;
            key_points_from_new_context: string[];
        }>;
        overall_assessment: string;
        error?: string;
    };
}
export const analyzeContextualUpdate = async (payload: CuaAnalysisPayload): Promise<CuaAnalysisResponse> => {
    // Assuming the backend route is /contextual_update/analyze
    // This needs to be created in your Flask backend (api_server.py)
    // For now, this is a placeholder. The actual API call will depend on your backend implementation.
    // Example structure:
    // const response = await axios.post<CuaAnalysisResponse>(`${API_BASE_URL}/contextual_update/analyze`, payload);
    // return response.data;

    // Mocking a response for now as the backend endpoint isn't fully defined in api_server.py
    console.warn("Mocking CUA API call. Implement backend for /contextual_update/analyze");
    return new Promise((resolve) => {
        setTimeout(() => {
            if (payload.new_context_text && payload.target_document_id) {
                resolve({
                    status: 'success',
                    analysis: {
                        summary_of_new_context: `Mock summary of: ${payload.new_context_text.substring(0, 50)}...`,
                        potential_impact_areas: [{
                            fas_excerpt_guess: `Relevant excerpt from ${payload.target_document_id} related to context.`,
                            reason_for_impact: "Mock reason: New regulations affect this area.",
                            suggested_action_type: "Review for Modification",
                            key_points_from_new_context: ["new disclosure requirements", "digital assets"]
                        }],
                        overall_assessment: "Medium Impact - Further Analysis Recommended (Mock Response)"
                    }
                });
            } else {
                resolve({ status: 'error', message: "Missing new context or target document ID (Mock Error)" });
            }
        }, 1500);
    });
};

// --- SRMA Types ---
export interface SrmaFileMetadata {
  file: File;
  fullName: string;
  shortCode: string;
}

export interface SrmaResponse {
  status: 'success' | 'error';
  message: string;
  output_file_path?: string;
  num_files_processed?: number;
}