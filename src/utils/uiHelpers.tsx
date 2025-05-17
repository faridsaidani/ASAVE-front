// src/utils/uiHelpers.ts
import type { LibraryPdfItem } from '../types';
import React from 'react';

export const renderLibraryItemCheckbox = (
    item: LibraryPdfItem,
    selectedArray: string[],
    setSelectedArray: React.Dispatch<React.SetStateAction<string[]>>,
    prefix: 'fas' | 'ss'
  ): React.ReactNode => {
    const commonInputClass = "mr-1.5 h-3.5 w-3.5 text-sky-600 focus:ring-sky-500 border-slate-300 rounded";
    const commonLabelClass = "text-xs text-slate-700 hover:text-sky-600 cursor-pointer truncate";
  
    if (item.type === 'file') {
      const itemId = `${prefix}-lib-${item.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
      return (
        <div key={itemId} className="flex items-center py-0.5">
          <input
            type="checkbox"
            id={itemId}
            value={item.name} // Store only the name for flat library structure
            checked={selectedArray.includes(item.name)}
            onChange={(e) => {
              const name = e.target.value;
              setSelectedArray(prev => e.target.checked ? [...prev, name] : prev.filter(n => n !== name));
            }}
            className={commonInputClass}
          />
          <label htmlFor={itemId} className={commonLabelClass} title={item.name}>
            {item.name}
          </label>
        </div>
      );
    } else if (item.type === 'directory' && item.files && item.files.length > 0) {
      const dirId = `${prefix}-dir-${item.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
      // For simplicity, if directories are just for visual grouping in UI but backend expects flat list of names:
      // We might simply list files, or if backend handles paths like "dirname/filename.pdf", adjust accordingly.
      // Assuming backend expects flat names for now, or specific paths if library is structured.
      // The backend example shows `secure_filename(name)` which implies flat names mostly.
      // If paths are used like "FAS/fas1.pdf", the `value` should be `item.name + '/' + f`.
      return (
        <div key={dirId} className="ml-1 mt-1">
          <p className="text-[11px] font-medium text-slate-500 mb-0.5">{item.name}/</p>
          <div className="pl-2 border-l border-slate-200 space-y-0.5">
            {item.files.map(f => {
              const fileInDirId = `${prefix}-lib-${item.name.replace(/[^a-zA-Z0-9]/g, '-')}-${f.replace(/[^a-zA-Z0-9]/g, '-')}`;
              const filePathOrName = `${item.name}/${f}`; // Assuming backend can handle this path structure
              return (
                <div key={fileInDirId} className="flex items-center">
                  <input
                    type="checkbox"
                    id={fileInDirId}
                    value={filePathOrName} 
                    checked={selectedArray.includes(filePathOrName)}
                    onChange={(e) => {
                      const pathValue = e.target.value;
                      setSelectedArray(prev => e.target.checked ? [...prev, pathValue] : prev.filter(n => n !== pathValue));
                    }}
                    className={commonInputClass}
                  />
                  <label htmlFor={fileInDirId} className={commonLabelClass} title={f}>
                    {f}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };