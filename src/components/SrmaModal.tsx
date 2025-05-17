import React, { useState } from 'react';
import Modal from './Modal';
import FileUploader from './FileUploader';
import { Loader2, FileText, Fingerprint, Edit2, Trash2 } from 'lucide-react';
import type { SrmaFileMetadata } from '../types';

interface SrmaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (filesWithMetadata: SrmaFileMetadata[]) => Promise<void>; // Make it async
  isProcessingSrma: boolean;
}

interface FileEntry extends SrmaFileMetadata {
  id: string; // For stable list rendering
}

const SrmaModal: React.FC<SrmaModalProps> = ({ isOpen, onClose, onSubmit, isProcessingSrma }) => {
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);

  const handleFilesUploaded = (uploadedFiles: FileList | File | null) => {
    if (!uploadedFiles) return;
    const filesArray = 'length' in uploadedFiles ? Array.from(uploadedFiles) : [uploadedFiles];
    
    const newEntries: FileEntry[] = filesArray.map((file, index) => ({
      id: `${file.name}-${Date.now()}-${index}`, // Unique ID
      file,
      fullName: '', // User will fill this
      shortCode: '', // User will fill this
    }));
    setFileEntries(prev => [...prev, ...newEntries]);
  };

  const handleMetadataChange = (id: string, field: 'fullName' | 'shortCode', value: string) => {
    setFileEntries(prev =>
      prev.map(entry => (entry.id === id ? { ...entry, [field]: value } : entry))
    );
  };

  const handleRemoveFileEntry = (id: string) => {
    setFileEntries(prev => prev.filter(entry => entry.id !== id));
  };
  

  const handleSubmitClick = async () => {
    if (fileEntries.some(entry => !entry.fullName.trim() || !entry.shortCode.trim())) {
      alert("Please provide a Full Name and Short Code for each uploaded file.");
      return;
    }
    await onSubmit(fileEntries);
    // Optionally clear form on successful submit, or let parent handle it.
    // For now, keeping files allows resubmission/modification if needed.
    // setFileEntries([]); // Uncomment to clear after submit
  };

  if (!isOpen) return null;

  return (
    <Modal title="Shari'ah Rule Miner (SRMA)" onClose={onClose} size="large"
      footer={
        <button
          onClick={handleSubmitClick}
          disabled={isProcessingSrma || fileEntries.length === 0}
          className="w-full btn-primary py-2.5 text-sm"
        >
          {isProcessingSrma ? <Loader2 className="inline mr-2 h-5 w-5 animate-spin" /> : '⛏️ '}
          Start Mining Rules
        </button>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-xs text-slate-600">
          Upload Shari'ah Standard (SS) PDF documents. For each document, provide a descriptive "Full Name" and a unique "Short Code" (e.g., SS1, SS_Murabaha) for rule identification.
        </p>
        
        <FileUploader
            label="Upload Shari'ah Standard PDF(s)"
            accept=".pdf"
            multiple
            onFilesUploaded={handleFilesUploaded}
            id="srma-modal-file-uploader-input" // Added id for programmatic click
        />
         {/* <button onClick={handleAddAnotherFile} className="btn-secondary-small text-xs mt-1"> <PlusCircle size={14} className="mr-1"/> Add More Files </button> */}


        {fileEntries.length > 0 && (
          <div className="space-y-3 mt-3 max-h-[40vh] overflow-y-auto scrollbar-thin pr-2">
            <h4 className="text-sm font-medium text-slate-700">File Metadata:</h4>
            {fileEntries.map((entry) => (
              <div key={entry.id} className="p-3 border border-slate-200 rounded-md bg-slate-50/50 space-y-2 relative">
                <button 
                    onClick={() => handleRemoveFileEntry(entry.id)}
                    className="absolute top-1.5 right-1.5 p-1 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-full"
                    title="Remove this file"
                >
                    <Trash2 size={14}/>
                </button>
                <p className="text-xs font-medium text-sky-700 truncate" title={entry.file.name}>
                  <FileText size={14} className="inline mr-1.5" /> {entry.file.name} ({(entry.file.size / 1024).toFixed(1)} KB)
                </p>
                <div>
                  <label htmlFor={`fullName-${entry.id}`} className="block text-xs font-medium text-slate-600">
                    <Edit2 size={12} className="inline mr-1"/> Full Standard Name:
                  </label>
                  <input
                    type="text"
                    id={`fullName-${entry.id}`}
                    value={entry.fullName}
                    onChange={(e) => handleMetadataChange(entry.id, 'fullName', e.target.value)}
                    placeholder="e.g., AAOIFI Shari'ah Standard No. 1"
                    className="input-field text-xs mt-0.5"
                  />
                </div>
                <div>
                  <label htmlFor={`shortCode-${entry.id}`} className="block text-xs font-medium text-slate-600">
                    <Fingerprint size={12} className="inline mr-1"/> Short Code:
                  </label>
                  <input
                    type="text"
                    id={`shortCode-${entry.id}`}
                    value={entry.shortCode}
                    onChange={(e) => handleMetadataChange(entry.id, 'shortCode', e.target.value)}
                    placeholder="e.g., SS1 or SS_Mudarabah"
                    className="input-field text-xs mt-0.5"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SrmaModal;
