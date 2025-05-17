// src/components/RightSidebar.tsx
import React from 'react';
import { Settings, SlidersHorizontal, Lightbulb, FileText, ListChecks, Info as InfoIcon, PocketKnife } from 'lucide-react'; // Added PocketKnife
import { useLocation, useNavigate } from 'react-router-dom';

interface RightSidebarProps {
  isOpen: boolean;
  isSystemInitialized: boolean;
  onSetupSystem: () => void; 
  onProcessContextualUpdate: () => void;
  onOpenSrmaModal: () => void; // New prop to open SRMA modal
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  isOpen,
  isSystemInitialized,
  onSetupSystem,
  onProcessContextualUpdate,
  onOpenSrmaModal, // Destructure new prop
}) => {
  if (!isOpen) return null;
  const navigate = useNavigate();
  const location = useLocation();

  const actionButtonClass = (isActive = false) => 
    `w-full flex items-center text-sm p-2.5 rounded-md transition-colors text-slate-700 ${
        isActive ? 'bg-sky-100 text-sky-700 font-medium border border-sky-300 shadow-sm' 
                 : 'hover:bg-slate-200'
    }`;
  const disabledClass = "opacity-60 cursor-not-allowed hover:bg-transparent";

  return (
    <aside className="w-64 bg-slate-50 border-l border-slate-300 p-3 flex flex-col shrink-0 space-y-3 scrollbar-thin overflow-y-auto">
      <div>
        <h2 className="font-semibold text-slate-700 mb-2 flex items-center text-sm">
          <Settings size={16} className="mr-1.5 text-sky-600"/>Global Tools
        </h2>
        <button 
          onClick={onSetupSystem} 
          className={`${actionButtonClass()} bg-sky-50 hover:bg-sky-100`}
        >
          <SlidersHorizontal size={16} className="mr-2 text-sky-600"/> System Setup
        </button>
        <button 
          onClick={onProcessContextualUpdate} 
          className={`${actionButtonClass()} ${!isSystemInitialized && disabledClass}`}
          disabled={!isSystemInitialized}
          title={!isSystemInitialized ? "Initialize system first" : "Analyze external text for impact on FAS"}
        >
          <Lightbulb size={16} className="mr-2 text-indigo-600"/> Contextual Update
        </button>
        <button  // SRMA Button
          onClick={onOpenSrmaModal}
          className={`${actionButtonClass()} ${!isSystemInitialized && disabledClass}`}
          disabled={!isSystemInitialized}
          title={!isSystemInitialized ? "Initialize system first" : "Mine Shari'ah Rules from Documents"}
        >
          <PocketKnife size={16} className="mr-2 text-orange-600"/> Shari'ah Rule Miner
        </button>
      </div>

      <hr className="my-2"/>

      <div>
        <h2 className="font-semibold text-slate-700 mb-2 flex items-center text-sm">
          <InfoIcon size={16} className="mr-1.5 text-sky-600"/>Navigation
        </h2>
        <button 
          onClick={() => navigate('/standards-enhancement')} 
          className={`${actionButtonClass(location.pathname.startsWith('/standards-enhancement'))} ${!isSystemInitialized && disabledClass}`}
          disabled={!isSystemInitialized}
          title={!isSystemInitialized ? "Initialize system first" : "Go to Standards Enhancement Editor"}
        >
          <FileText size={16} className="mr-2 text-blue-600"/> FAS Editor
        </button>
        <button 
          onClick={() => navigate('/contract-verification')} 
          className={`${actionButtonClass(location.pathname.startsWith('/contract-verification'))} ${!isSystemInitialized && disabledClass}`}
          disabled={!isSystemInitialized}
          title={!isSystemInitialized ? "Initialize system first" : "Go to Contract Verification Suite"}
        >
          <ListChecks size={16} className="mr-2 text-teal-600"/> Contract Suite
        </button>
      </div>
    </aside>
  );
};

export default RightSidebar;