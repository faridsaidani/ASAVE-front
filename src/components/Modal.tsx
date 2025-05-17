// src/components/Modal.tsx
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'normal' | 'medium' | 'large' | 'xlarge';
  footer?: React.ReactNode; // Optional footer for actions
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children, size = 'normal', footer }) => {
  let modalWidthClass = 'max-w-lg'; // normal
  if (size === 'medium') modalWidthClass = 'max-w-2xl';
  if (size === 'large') modalWidthClass = 'max-w-4xl';
  if (size === 'xlarge') modalWidthClass = 'max-w-6xl';

  // Prevent clicks inside the modal from closing it
  const handleModalContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-4 transition-opacity duration-300 ease-in-out animate-fadeIn"
      onClick={onClose} // Close on overlay click
    >
      <div 
        className={`bg-white rounded-xl shadow-2xl w-full ${modalWidthClass} max-h-[90vh] flex flex-col transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalContentAppear`}
        onClick={handleModalContentClick}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto scrollbar-thin flex-grow">
          {children}
        </div>
        {footer && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl sticky bottom-0 z-10">
                {footer}
            </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes modalContentAppear { 
          0% { transform: scale(0.95) translateY(10px); opacity: 0; } 
          100% { transform: scale(1) translateY(0); opacity: 1; } 
        }
        .animate-modalContentAppear { animation: modalContentAppear 0.3s 0.1s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Modal;