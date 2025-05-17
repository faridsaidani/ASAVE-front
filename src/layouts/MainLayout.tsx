// src/layouts/MainLayout.tsx
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import LeftSidebar from '../components/LeftSidebar';
import RightSidebar from '../components/RightSidebar';
import { MessageCircleQuestion, ChevronsLeft, ChevronsRight, X, LogOut, Info as InfoIcon, Activity } from 'lucide-react';
import type { SessionInfo, ChatMessage } from '../types';

interface MainLayoutProps {
  apiMessage: { type: 'info' | 'success' | 'error' | 'warning', text: string } | null;
  setApiMessage: React.Dispatch<React.SetStateAction<{ type: 'info' | 'success' | 'error' | 'warning', text: string } | null>>;
  
  sessions: SessionInfo[];
  currentSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onCreateNewSession: () => void;
  onRefreshSessions: () => void;

  onSetupSystem: () => void;
  isSystemInitialized: boolean;
  onProcessContextualUpdate: () => void;

  globalSseControllerRef: React.RefObject<AbortController | null>;
  addMessageToChat: (sender: ChatMessage['sender'], text?: string, component?: React.ReactNode, isLoadingPlaceholder?: boolean) => string;
  activeDocumentIdForCUA: string; // For RightSidebar context

  onOpenSrmaModal: () => void, // Destructure

}

const MainLayout: React.FC<MainLayoutProps> = ({
  apiMessage, setApiMessage,
  sessions, currentSessionId, onLoadSession, onCreateNewSession, onRefreshSessions,
  onSetupSystem, isSystemInitialized, onProcessContextualUpdate,
  globalSseControllerRef, addMessageToChat, activeDocumentIdForCUA, onOpenSrmaModal
}) => {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);


  // Auto-close API message after a delay
  useEffect(() => {
    if (apiMessage) {
      const timer = setTimeout(() => setApiMessage(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [apiMessage, setApiMessage]);
  
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
      isActive ? 'bg-sky-800 text-white shadow-inner' : 'text-sky-100 hover:bg-sky-600 hover:text-white'
    }`;

  const handleGlobalSSECancel = () => {
    if (globalSseControllerRef.current) {
        globalSseControllerRef.current.abort();
        addMessageToChat('system', "Global AI task cancellation requested.");
    } else {
        addMessageToChat('system', "No active global AI task to cancel.");
    }
  };

  // This is a simplified placeholder. Actual active page's SSE controller would be better.
  // This button is less useful if each page manages its own SSE controller.
  const isAnyPageLoading = () => {
    // This is a placeholder. Ideally, each page would report its loading state up
    // or a global loading context would be used.
    // For now, we can check if the global SSE controller is active.
    return !!globalSseControllerRef.current; 
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 text-slate-800 overflow-hidden">
      <header className="p-3 bg-sky-700 text-white flex justify-between items-center shadow-md shrink-0 relative z-20">
        <div className="flex items-center">
          <button 
            onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)} 
            className="mr-2 p-1.5 hover:bg-sky-600 rounded-md"
            title={isLeftSidebarOpen ? "Hide Session Panel" : "Show Session Panel"}
          >
            {isLeftSidebarOpen ? <ChevronsLeft size={20}/> : <ChevronsRight size={20}/>}
          </button>
          <MessageCircleQuestion size={26} className="mr-2 transform -scale-x-100 text-sky-300" />
          <h1 className="text-lg font-semibold mr-6">ASAVE Suite</h1>
          <nav className="hidden md:flex space-x-1">
            <NavLink to="/" className={navLinkClass} end><InfoIcon size={16}/><span>Chat/Home</span></NavLink>
            <NavLink to="/standards-enhancement" className={navLinkClass}><Activity size={16}/><span>Standards Enhancement</span></NavLink>
            <NavLink to="/contract-verification" className={navLinkClass}><LogOut size={16} className="transform rotate-90"/><span>Contract Suite</span></NavLink>
          </nav>
        </div>
        <div className="flex items-center space-x-2">
          {currentSessionId && <span className="text-xs px-2.5 py-1 bg-sky-500/80 rounded-full backdrop-blur-sm">Session: {currentSessionId}</span>}
          <button 
            onClick={handleGlobalSSECancel}
            disabled={!isAnyPageLoading()} 
            className="text-xs px-2.5 py-1 bg-orange-500 hover:bg-orange-600 rounded-md shadow-sm disabled:opacity-60"
          >
            Cancel AI
          </button>
          <button 
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} 
            className="p-1.5 hover:bg-sky-600 rounded-md"
            title={isRightSidebarOpen ? "Hide Controls Panel" : "Show Controls Panel"}
          >
            {isRightSidebarOpen ? <ChevronsRight size={20}/> : <ChevronsLeft size={20}/>}
          </button>
        </div>
      </header>
      
      {apiMessage && (
        <div 
            className={`fixed top-[calc(4rem)] left-1/2 -translate-x-1/2 min-w-[300px] max-w-md w-auto z-50 p-3.5 rounded-lg text-sm shadow-xl border-l-4 flex items-start justify-between transition-all duration-300 ease-out animate-slideDownAndFadeIn
                ${apiMessage.type === 'error' ? 'bg-red-100 text-red-800 border-red-600' : 
                  apiMessage.type === 'success' ? 'bg-green-100 text-green-800 border-green-600' : 
                  apiMessage.type === 'warning' ? 'bg-yellow-100 text-yellow-800 border-yellow-500' : 
                  'bg-blue-100 text-blue-800 border-blue-500'}`}
        >
            <span>{apiMessage.text}</span>
            <button onClick={() => setApiMessage(null)} className="ml-3 text-inherit hover:opacity-75 p-0.5 -mr-1 -mt-1 rounded-full">
                <X size={18}/>
            </button>
            <style>{`
                @keyframes slideDownAndFadeIn { 
                    0% { opacity: 0; transform: translateY(-20px) translateX(-50%); } 
                    100% { opacity: 1; transform: translateY(0) translateX(-50%); } 
                }
                .animate-slideDownAndFadeIn { animation: slideDownAndFadeIn 0.4s ease-out forwards; }
            `}</style>
        </div>
      )}

      <div className="flex flex-row flex-grow min-h-0">
        <LeftSidebar 
            isOpen={isLeftSidebarOpen} 
            sessions={sessions} 
            currentSessionId={currentSessionId}
            onLoadSession={onLoadSession}
            onCreateNewSession={onCreateNewSession}
            onRefreshSessions={onRefreshSessions}
        />

        <main className="flex-grow flex flex-col bg-slate-200/70 overflow-hidden">
          {/* Outlet renders the matched page component */}
          <Outlet context={{ activeDocumentIdForCUA }} /> 
        </main>

        <RightSidebar
          isOpen={isRightSidebarOpen}
          isSystemInitialized={isSystemInitialized}
          onSetupSystem={onSetupSystem}
          onProcessContextualUpdate={onProcessContextualUpdate}
          onOpenSrmaModal={onOpenSrmaModal} // Pass it down
        />
      </div>
    </div>
  );
};

export default MainLayout;