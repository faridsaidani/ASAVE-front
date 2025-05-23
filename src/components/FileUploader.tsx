// src/components/FileUploader.tsx
import React, { type ChangeEvent, useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileUploaderProps {
  onFilesUploaded: (files: File | FileList | null) => void;
  label: string;
  accept: string;
  multiple?: boolean;
  id?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesUploaded,
  label,
  accept,
  multiple = false,
  id,
}) => {
  const [fileNames, setFileNames] = useState<string[]>([]);
  const inputId = id || `file-upload-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      if (multiple) {
        onFilesUploaded(event.target.files);
        if (event.target.files.length > 0) {
          setFileNames(Array.from(event.target.files).map(f => f.name));
        } else {
          setFileNames([]);
        }
      } else {
        onFilesUploaded(event.target.files[0]);
        if (event.target.files.length > 0) {
          setFileNames([event.target.files[0].name]);
        } else {
          setFileNames([]);
        }
      }
    } else {
      onFilesUploaded(null);
      setFileNames([]);
    }
  };
  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md hover:border-[#0ea5e9] transition-colors bg-slate-50/50 group">
        <div className="space-y-1 text-center">
          <UploadCloud className="mx-auto h-10 w-10 text-slate-400 group-hover:text-[#0ea5e9] transition-colors" />
          <div className="flex text-sm text-slate-600">
            <label
              htmlFor={inputId}
              className="relative cursor-pointer rounded-md font-medium text-[#0284c7] hover:text-[#0ea5e9] focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#0ea5e9]"
            >
              <span className="hover:underline">Upload file{multiple ? 's' : ''}</span>
              <input id={inputId} name={inputId} type="file" className="sr-only" accept={accept} multiple={multiple} onChange={handleFileChange} />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-slate-500">{accept} files</p>
        </div>
      </div>
      {fileNames.length > 0 && (
        <div className="mt-2 text-xs flex flex-wrap gap-1">
          {fileNames.map((name, idx) => (
            <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#e0f2fe] text-[#075985]">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploader;