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

export interface ValidatedSuggestionPackage {
  source_agent_type: string;
  source_agent_name: string;
  suggestion_details: SuggestionDetails;
  scva_report: any; 
  iscca_report: any; 
  validation_summary_score: string;
}

export interface SSEEventData {
  event_type: "system_log" | "progress" | "agent_suggestion_generated" | "validated_suggestion_package" | "warning" | "error" | "fatal_error" | "final_summary" | "clause_processing_start" | "clause_validation_result" | "clause_ai_suggestion_generated" | "clause_processing_end" | "full_contract_review_completed";
  message?: string; 
  step_code?: string;
  agent_name?: string;
  payload?: any | ValidatedSuggestionPackage | { total_validated_suggestions: number };
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

export const getAssistanceStreamUrl = (): string => `${API_BASE_URL}/get_assistance_stream`;

export const getApiStatus = async (): Promise<ApiStatusResponse> => {
    try {
        const response = await axios.get<ApiStatusResponse>(`${API_BASE_URL}/status`);
        return response.data;
    } catch (error: any) {
        console.error("Error fetching API status:", error.response?.data || error.message);
        throw error.response?.data || new Error("Network or status fetch error");
    }
};

// Add other API functions if needed (e.g., for contextual update agent)
export const analyzeContextualUpdate = async (payload: { new_context_text: string; target_document_id: string; }) => { // <--- ADDED EXPORT HERE
    const response = await axios.post(`${API_BASE_URL}/contextual_update/analyze`, payload);
    return response.data; 
};