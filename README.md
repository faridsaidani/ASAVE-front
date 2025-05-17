# ASAVE Interactive Suite - Frontend

This frontend application provides an interactive user interface for the ASAVE (AI-Powered Shari'ah Audit & Verification Engine) system. It enables users to interact with AI agents for tasks related to AAOIFI standards enhancement, Shari'ah contract verification, document processing, and rule mining.

Built with **React, TypeScript, Vite, and Tailwind CSS**.

## Features

- **Multi-Page Interface**:
  - **Chat/Home**: General interaction and landing page for simple commands.
  - **Standards Enhancement**: Load, edit, and receive AI-powered suggestions for Financial Accounting Standards (FAS) documents.
    - Markdown editor with preview.
    - Text selection for targeted AI assistance.
    - AI suggestions with diff view, reasoning, confidence scores, and validation reports (SCVA & ISCCA).
    - Accept/Reject suggestions directly in the editor.
    - Document versioning (save, list, revert).
  - **Contract Suite**: Tools for Shari'ah compliance checking of contracts.
    - Clause-by-clause validation and AI suggestion generation.
    - Full contract text review with detailed AI reports.
- **System Initialization & Session Management**:
  - Upload FAS, Shari'ah Standards (SS), and explicit Shari'ah rule files to initialize or update the backend knowledge base.
  - Select files from a pre-configured server-side PDF library.
  - Create and save named sessions for different projects or knowledge base configurations.
  - Load existing sessions.
- **AI-Powered Tools (Right Sidebar & Modals)**:
  - **Contextual Update Analysis (CUA)**: Analyze the impact of new external information (news, guidelines) on a target FAS document.
  - **Shari'ah Rule Miner (SRMA)**: Upload Shari'ah Standard PDFs, provide metadata, and trigger backend rule mining.
- **Real-time Progress & Feedback**:
  - Server-Sent Events (SSE) for streaming updates during long-running AI processes.
  - Notifications and messages for API interactions and system status.
- **Responsive Design**: Tailwind CSS for a modern, adaptable UI.

## Core Technologies

- **React**: UI library.
- **TypeScript**: Static typing.
- **Vite**: Fast build tool and dev server.
- **Tailwind CSS**: Utility-first CSS framework.
- **`react-router-dom`**: Client-side routing.
- **`axios`**: HTTP requests.
- **`lucide-react`**: Icons.
- **`react-markdown` & `remark-gfm`**: Markdown rendering.
- **`diff`**: Text difference generation.

## Project Structure

```
/src/
├── App.tsx                # Root component with Router logic & global state
├── main.tsx               # Entry point, renders App
├── index.css              # Global styles & Tailwind directives
├── App.css                # (Legacy or Vite default styles)
├── vite-env.d.ts          # Vite environment types
├── assets/                # Static assets (SVGs, etc.)
├── components/            # Reusable UI components
│   ├── FileUploader.tsx
│   ├── SuggestionCard.tsx
│   ├── LeftSidebar.tsx
│   ├── RightSidebar.tsx
│   ├── FasEditorPage.tsx  # Core editor (used by StandardsEnhancementPage)
│   ├── Modal.tsx
│   └── SrmaModal.tsx
├── layouts/
│   └── MainLayout.tsx     # Common layout (header, sidebars, outlet)
├── pages/                 # Route-specific page components
│   ├── StandardsEnhancementPage.tsx
│   ├── ContractVerificationPage.tsx
│   └── ChatPage.tsx
├── services/
│   └── api.ts             # API functions and type definitions
├── types.ts               # Shared TypeScript types
└── utils/
    └── uiHelpers.ts       # UI utility functions
```

## Getting Started

1. **Prerequisites**:
   - Node.js (16.x or higher)
   - npm or yarn

2. **Clone the repository** (if applicable).

3. **Navigate to the frontend directory**:
   ```bash
   cd path/to/your/frontend
   ```

4. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   ```

5. **Configure Environment Variables**:
   - Create a `.env` file in the frontend root.
   - Add the backend API base URL:
     ```env
     VITE_API_BASE_URL=http://localhost:5001
     ```
     (Adjust if your backend runs on a different port or host.)

6. **Run the development server**:
   ```bash
   npm run dev
   # or
   yarn dev
   ```
   The app usually starts on `http://localhost:5173` (or another port if 5173 is busy).

7. **Ensure the Backend is Running**: The frontend relies on the ASAVE backend API (Python/Flask). Make sure the backend server is running and accessible at the URL specified in `VITE_API_BASE_URL`.

## Key Components & Logic Flow

- **`App.tsx`**: Manages global state (system initialization, session info, library PDFs, global modals) and sets up main routes.
- **`MainLayout.tsx`**: Provides page structure (header, navigation, sidebars) and uses `<Outlet />` for active page content.
- **Page Components**:
  - `ChatPage`, `StandardsEnhancementPage`, `ContractVerificationPage`: Each handles UI and logic for its feature set, receiving global state and helpers from `App.tsx`.
    - `StandardsEnhancementPage`: FAS document editing, PDF loading, Markdown editing, AI suggestions panel.
    - `ContractVerificationPage`: Forms for contract clause/full text submission, displays streamed results.
- **`api.ts`**: Backend API interaction functions and TypeScript interfaces.
- **Modals**: For complex inputs (System Initialization, Contextual Update, SRMA). Controlled by `activeModal` state in `App.tsx`.
- **SSE Handling**: Long-running AI tasks use Server-Sent Events for real-time progress/results, with `AbortController` for cancellation.

## Development Notes

- The app depends on the backend being available and correctly configured (especially `GOOGLE_API_KEY` for AI agents).
- Styling uses Tailwind CSS utility classes.
- Type safety via interfaces/types in `src/types.ts` and `src/services/api.ts`.
- Error handling and user feedback through notifications and component messages.
