/* eslint-disable @typescript-eslint/no-explicit-any */
// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
import type { InitResponse, ApiStatusResponse, SrmaFileMetadata, SrmaResponse } from '../types'; // Adjust the import path as needed



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

export const mineShariahRules = async (filesWithMetadata: SrmaFileMetadata[]): Promise<SrmaResponse> => {
  const formData = new FormData();
  filesWithMetadata.forEach((item, index) => {
    formData.append('ss_files_for_srma', item.file, item.file.name);
    formData.append(`ss_files_for_srma_${index}_fullname`, item.fullName);
    formData.append(`ss_files_for_srma_${index}_shortcode`, item.shortCode);
  });

  // Optional: allow user to specify output_directory if needed, or use backend default
  // formData.append('output_directory', 'custom_srma_output');

  try {
    const response = await axios.post<SrmaResponse>(`${API_BASE_URL}/mine_shariah_rules`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    console.error("Error mining Shari'ah rules:", error.response?.data || error.message);
    return {
        status: 'error',
        message: error.response?.data?.message || "Network error or SRMA processing failed.",
    };
  }
};
