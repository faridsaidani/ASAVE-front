# 🚀 ASAVE Text-Based Assistant

A modern, AI-powered web application for extracting, editing, and enhancing text from FAS/SS PDF documents, built with **React**, **TypeScript**, and **Vite**. This project is designed for Shariah-compliant document workflows, providing Markdown extraction, AI suggestions, and a beautiful, responsive UI.

---

## ✨ Features

- **PDF to Markdown Extraction**: Upload FAS/SS PDFs and extract clean, editable Markdown (with image support).
- **AI Assistance**: Select text and get AI-powered suggestions for improvements, compliance, or reformatting.
- **Live Markdown Editing & Preview**: Toggle between raw Markdown editing and a styled preview.
- **Image Handling**: Extracted images are referenced as web URLs for easy display (requires backend support).
- **Backend Initialization**: Upload multiple FAS/SS PDFs and optional rules to initialize the backend knowledge base.
- **Progress & Logs Sidebar**: See real-time logs, AI suggestion cards, and accept/reject changes.
- **Modern UI**: Built with Tailwind CSS, Lucide icons, and responsive layouts.

---

## 🏗️ Project Structure

```
frontend/
├── public/                # Static assets (pdf.worker, icons, etc.)
├── src/
│   ├── App.tsx            # Main React app (core logic)
│   ├── components/
│   │   ├── FileUploader.tsx
│   │   ├── Sidebar.tsx
│   │   └── SuggestionCard.tsx
│   ├── services/
│   │   └── api.ts         # API types and helpers
│   ├── assets/            # Images, SVGs
│   ├── index.css          # Tailwind & global styles
│   └── main.tsx           # App entry point
├── package.json           # Dependencies & scripts
├── tailwind.config.js     # Tailwind CSS config
├── vite.config.ts         # Vite config
└── ...
```

---

## ⚡ Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Yarn](https://yarnpkg.com/) or [npm](https://www.npmjs.com/)

### 2. Install Dependencies

```sh
npm install
# or
yarn install
```

### 3. Configure Environment

- Copy `.env` if needed and set your backend API URL:

```
VITE_API_BASE_URL=http://localhost:5001
```

### 4. Start the Development Server

```sh
npm run dev
# or
yarn dev
```

- App will be available at [http://localhost:5173](http://localhost:5173) (default Vite port).

### 5. Build for Production

```sh
npm run build
```

---

## 🧩 Key Components

- **App.tsx**: Main logic for file upload, PDF extraction, AI assistance, Markdown editing/preview, and state management.
- **FileUploader.tsx**: Reusable drag-and-drop file uploader.
- **Sidebar.tsx**: Displays progress logs and AI suggestions.
- **SuggestionCard.tsx**: Shows AI suggestion details, Markdown diff, and accept/reject actions.
- **api.ts**: TypeScript types and API helper functions.

---

## 🤖 AI Assistance Workflow

1. **Upload PDF**: Select a FAS/SS PDF to extract Markdown.
2. **Edit/Preview**: Edit the Markdown or preview the formatted document.
3. **Select Text**: Highlight a section to get AI suggestions.
4. **Get Suggestions**: Click "Get AI Suggestions" to receive improvement proposals.
5. **Accept/Reject**: Apply suggestions directly or copy them for manual use.

---

## 🖼️ Image Handling

- Extracted images are referenced in Markdown as web URLs (e.g., `![](http://localhost:5001/marker_images_static/UNIQUE_PDF_ID/image.jpeg)`).
- Backend must serve these images from a static folder for them to display in the preview.

---

## 🛠️ Tech Stack

- ⚛️ **React** + **TypeScript**
- ⚡ **Vite** (fast dev/build)
- 🎨 **Tailwind CSS** (with typography plugin)
- 🦄 **Lucide Icons**
- 📝 **react-markdown** + **remark-gfm** (GitHub-flavored Markdown)
- 🔗 **Axios** (API calls)
- 🧠 **diff** (text diffing for suggestions)

---

## 📂 Environment Variables

- `VITE_API_BASE_URL`: Backend API endpoint (default: `http://localhost:5001`)

---

## 🧑‍💻 Development Notes

- Lint with `npm run lint` (ESLint + TypeScript)
- Tailwind CSS is used for all styling; customize in `tailwind.config.js`.
- All API types and SSE event structures are defined in `src/services/api.ts`.
- For best results, ensure your backend implements the required endpoints and static image serving.

---

## 📝 License

This project is for internal or research use. See individual file headers or contact the author for licensing details.

---

## 🙏 Acknowledgements

- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [react-markdown](https://github.com/remarkjs/react-markdown)

---

## 💬 Feedback & Contributions

Feel free to open issues or suggest improvements!
