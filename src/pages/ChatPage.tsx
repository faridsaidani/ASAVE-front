// src/pages/ChatPage.tsx
import React, {useEffect} from 'react';
import { User, Bot, Settings, Send, Loader2 } from 'lucide-react';
import type { ChatMessage, LibraryPdfItem } from '../types'; // Assuming types.ts

interface ChatPageProps {
  chatMessages: ChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>; // If chat commands can add messages
  userInput: string;
  setUserInput: React.Dispatch<React.SetStateAction<string>>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  addMessageToChat: (sender: ChatMessage['sender'], text?: string, component?: React.ReactNode, isLoadingPlaceholder?: boolean) => string;
  updateChatMessage: (messageId: string, newText?: string, newComponent?: React.ReactNode, stopLoading?: boolean) => void;
  // Add specific command handlers or pass them down
  onTriggerInitModal: () => void;
  onTriggerCUAModal: () => void;
  libraryPdfs: LibraryPdfItem[];
}

const ChatPage: React.FC<ChatPageProps> = ({
  chatMessages,
  userInput,
  setUserInput,
  chatContainerRef,
  addMessageToChat,
  onTriggerInitModal,
  onTriggerCUAModal,
  libraryPdfs
}) => {

  const handleUserChatInput = () => {
    const trimmedInput = userInput.trim().toLowerCase();
    if (!trimmedInput) return;
    addMessageToChat('user', userInput);
    setUserInput('');

    // Simple command parsing
    if (trimmedInput === 'help') {
      addMessageToChat('ai', undefined, 
        <div className="space-y-1 text-sm">
          <p>You can navigate to specific tools using the main navigation.</p>
          <p>Common global actions available via sidebars or modals:</p>
          <ul className="list-disc list-inside">
            <li>'<strong>new session</strong>' or '<strong>initialize system</strong>' (opens System Setup modal)</li>
            <li>'<strong>list library</strong>' (shows available PDFs on server)</li>
            <li>'<strong>contextual update</strong>' or '<strong>analyze context</strong>' (opens Contextual Update modal)</li>
          </ul>
          <p>For FAS Document editing and Contract Verification, please use their dedicated pages.</p>
        </div>
      );
    } else if (trimmedInput === 'new session' || trimmedInput === 'create session' || trimmedInput === 'initialize system') {
        onTriggerInitModal();
    } else if (trimmedInput === 'list library') {
        if (libraryPdfs.length > 0) {
            addMessageToChat('ai', 'PDFs available in server library:', 
            <div className="text-xs max-h-40 overflow-y-auto bg-slate-100 p-1 rounded">
                {libraryPdfs.map(item => (
                    <div key={item.name}>{item.type === 'file' ? `📄 ${item.name}` : `📁 ${item.name}/ ${item.files?.join(', ')}`}</div>
                ))}
            </div>);
        } else {
            addMessageToChat('ai', "No PDF files found in the server library, or library not yet fetched.");
        }
    } else if (trimmedInput === 'contextual update' || trimmedInput === 'analyze context') {
        onTriggerCUAModal();
    }
    else {
      addMessageToChat('ai', `I received: "${trimmedInput}". For specific actions, please use the main navigation or type 'help'.`);
    }
  };

  useEffect(() => {
    chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
  }, [chatMessages, chatContainerRef]);

  return (
    <div className="flex flex-col h-full">
      <div ref={chatContainerRef} className="flex-grow p-3 sm:p-4 space-y-3 overflow-y-auto scrollbar-thin">
        {chatMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-2.5 rounded-xl shadow-sm text-sm ${
              msg.sender === 'user' ? 'bg-sky-500 text-white rounded-br-none' : 
              msg.sender === 'ai' ? 'bg-white text-slate-700 rounded-bl-none border border-slate-200' : 
              'bg-slate-100 text-slate-600 rounded-bl-none border border-slate-200'
            }`}>
              <div className="flex items-center mb-1 text-xs opacity-70">
                {msg.sender === 'user' ? <User size={12} className="mr-1" /> : 
                 msg.sender === 'ai' ? <Bot size={12} className="mr-1" /> : 
                 <Settings size={12} className="mr-1" />}
                <span>{msg.sender.toUpperCase()}</span>
                <span className="mx-1.5 text-[9px]">●</span>
                <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {msg.text && <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
              {msg.component && <div className="mt-1">{msg.component}</div>}
              {msg.isLoading && <Loader2 size={16} className="animate-spin my-1 text-sky-500" />}
            </div>
          </div>
        ))}
      </div>
      <footer className="p-2.5 border-t border-slate-300 bg-slate-50 shrink-0">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleUserChatInput()}
            placeholder="Type your command or message (e.g., 'help')..."
            className="flex-grow input-field py-2 px-3 text-sm"
          />
          <button onClick={handleUserChatInput} className="btn-primary py-2 px-3.5">
            <Send size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;