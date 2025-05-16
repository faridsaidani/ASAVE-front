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
}

export interface ApiStatusResponse {
  service_status: string;
  asave_initialized: boolean;
  config?: {
    google_api_key_set?: boolean;
    [key: string]: any;
  };
  components_loaded?: {
    [key: string]: boolean | number;
  };
}

// SSE Event Data Structures (examples, align with your backend)
export interface ProgressEventPayload {
  step_code?: string;
  agent_name?: string;
  message: string;
  payload?: any;
}

export interface ValidatedSuggestionPackage {
  source_agent_type: string;
  source_agent_name: string;
  suggestion_details: {
    original_text: string;
    proposed_text: string;
    change_type: string;
    reasoning: string;
    shariah_notes: string;
    prompt_details_actual?: any;
  };
  scva_report: any; // Define more specific types if possible
  iscca_report: any; // Define more specific types if possible
  validation_summary_score: string;
}

export interface SSEEventData {
  event_type: "system_log" | "progress" | "agent_suggestion_generated" | "validated_suggestion_package" | "warning" | "error" | "fatal_error" | "final_summary";
  message: string;
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