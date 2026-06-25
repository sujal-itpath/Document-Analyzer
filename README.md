# Agentic AI Document Analyzer

Welcome to the **Agentic AI Document Analyzer**, a full-stack, intelligent document assistant. This platform allows you to upload documents, analyze them using a state-of-the-art Agentic AI, and interact with your data in powerful ways through a modern, split-view interface.

## 🚀 Key Features

*   **Intelligent Chat Agent:** Chat with a ReAct AI agent (powered by LangGraph, LangChain, and Ollama/Groq) that actively uses tools to search, summarize, and compare your documents in real-time.
*   **Generative UI & Split View:** Don't just read plain text. The application dynamically opens interactive side-panels to view your source documents or structured data without losing your chat context.
*   **Automated Test Case Generation:** Instantly generate structured QA test cases (Manual, API, Smoke, Regression) directly from your requirements documents. View them in an interactive table, track generation history, and edit them on the fly.
*   **Jira Integration:** Connect your Jira workspace to draft and push issues, user stories, and bug reports directly from the AI chat based on your analyzed documents.
*   **Advanced RAG Pipeline:** robust backend that automatically processes PDFs, images (via OCR), and text files, chunks them, and stores them in a local ChromaDB vector store.
*   **Conversation Memory:** The AI remembers your chat history within a session, allowing for deep, continuous follow-up questions.

## 🏗️ Architecture Overview

The system is split into a modern React frontend and a FastAPI Python backend:

*   **Frontend (Next.js & React 19):** Built with Tailwind CSS and Lucide icons. It features a responsive dashboard, multi-document selection, interactive agent chat with markdown/streaming support, and dynamic side-panels for Test Cases and Jira integrations.
*   **Backend (FastAPI & LangGraph):** Handles user authentication (JWT), file processing (`pdfplumber`, `unstructured`), vector embedding, and database management (SQLite & ChromaDB). The core brain is a LangGraph ReAct agent that loops between reasoning and executing retrieval tools.

## 🛠️ Getting Started

### Prerequisites
*   Node.js (for the frontend)
*   Python 3.9+ (for the backend)
*   [Ollama](https://ollama.ai/) installed locally (or a valid Groq API key)

### 1. Start the Backend
Navigate to the backend directory, install the Python dependencies, and run the FastAPI server:

```bash
cd report_debug_agent
pip install -r requirements.txt
python run.py
# or: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*The backend will be available at `http://localhost:8000`*

### 2. Start the Frontend
Navigate to the frontend directory, install the Node packages, and start the development server:

```bash
cd react_agent/react_agent
npm install
npm run dev
```
*The frontend will be available at `http://localhost:3000`*

## 💡 How to Use

1.  **Sign Up & Login:** Create an account to access your personal workspace.
2.  **Upload Documents:** Head to the Documents tab and upload your PDFs, DOCX, or text files. The backend will automatically parse and index them.
3.  **Start a Chat:** Select one or more documents and start a new chat session. 
4.  **Explore Agent Actions:** Ask the agent to summarize a document, find specific clauses, or compare two different files.
5.  **Generate Test Cases:** Click the ✨ **Generate Test Cases** button above the chat box to automatically extract test plans into the interactive side-panel.

---
*Built with Next.js, FastAPI, LangGraph, and ChromaDB.*