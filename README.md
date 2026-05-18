# Document Analysis Agent - Project Flow Documentation

## 1. Project Overview

This project is a full-stack Agentic AI document analysis system. The user can sign up, log in, upload documents, select one or more documents, and chat with an AI agent that uses retrieval tools to answer questions from the uploaded document knowledge base.

The system has two main parts:

- Frontend: `react_agent/react_agent`
  - A Next.js + React application.
  - Handles login/signup, document upload and management, chat UI, chat history, and streamed assistant responses.

- Backend: `report_debug_agent`
  - A FastAPI application.
  - Handles authentication, document upload, document processing, vector indexing, chat sessions, message persistence, and agent execution.

At a high level, the application follows this flow:

1. User authenticates through the frontend.
2. Backend creates or validates a JWT token.
3. User uploads documents from the dashboard.
4. Backend saves files, extracts text/tables/OCR content, creates vector embeddings, stores chunks in ChromaDB, and stores document metadata in SQLite.
5. User asks a question in chat.
6. Backend runs a LangGraph ReAct agent with tools.
7. The agent retrieves relevant document chunks from ChromaDB and produces an answer.
8. Backend streams tokens back to the frontend.
9. Frontend displays the response live and saves chat/session context.

## 2. Repository Structure

```text
Agentic AI Learning Project/
  react_agent/
    react_agent/
      app/
        layout.tsx
        page.tsx
        login/page.tsx
        signup/page.tsx
        dashboard/page.tsx
        globals.css
      components/
        Sidebar.tsx
        HomeView.tsx
        ChatInterface.tsx
        UploadSection.tsx
      context/
        AuthContext.tsx
      package.json

  report_debug_agent/
    app/
      main.py
      api/
        router.py
        endpoints/
          auth.py
          upload.py
          chat.py
      core/
        config.py
        security.py
      db/
        database.py
      services/
        document_processor.py
        analyzer.py
      history_manager.py
    agent/
      agent.py
    rag/
      vector_store.py
      graph_store.py
    tools/
      document_search.py
      summarize_document.py
      compare_documents.py
      graph_search.py
    configs/
      system_prompt.txt
      tools_config.py
    requirements.txt
```

## 3. Technology Stack

Frontend:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Lucide React icons
- React Markdown + remark-gfm for rendering assistant markdown

Backend:

- FastAPI
- SQLAlchemy
- SQLite
- JWT authentication using `python-jose`
- Password hashing using `passlib[bcrypt]`
- LangChain
- LangGraph ReAct agent
- LangGraph SQLite checkpointer
- Ollama chat model
- Ollama embedding model
- ChromaDB vector store
- pdfplumber and unstructured for document parsing
- networkx for a lightweight knowledge graph

AI/RAG:

- Chat model: `gemma4:e4b`
- Embedding model: `nomic-embed-text:latest`
- Ollama base URL: `http://192.168.1.240:11434`
- Vector DB: Chroma persisted under `report_debug_agent/chroma_db`
- Agent memory/checkpoints: SQLite file `report_debug_agent/memory.sqlite`

## 4. Frontend Architecture

### 4.1 Root Layout

File: `react_agent/react_agent/app/layout.tsx`

The root layout imports global CSS and wraps the application inside `AuthProvider`.

```tsx
<AuthProvider>
  {children}
</AuthProvider>
```

This means every page can call `useAuth()` to access:

- `token`
- `user`
- `loading`
- `login()`
- `logout()`
- `isAuthenticated`

### 4.2 Auth Context

File: `react_agent/react_agent/context/AuthContext.tsx`

This is the frontend authentication state manager.

Responsibilities:

- Reads `auth_token` and `auth_user` from `localStorage` when the app starts.
- Stores auth state in React state.
- Provides `login(token)`:
  - Saves token in `localStorage`.
  - Stores a placeholder user object.
  - Navigates to `/dashboard`.
- Provides `logout()`:
  - Removes token and user from `localStorage`.
  - Clears auth state.
  - Navigates to `/login`.

Important note:

The frontend currently stores a placeholder user email as `user@example.com`. The backend validates users correctly, but the frontend does not decode the JWT or fetch the real user profile.

### 4.3 Initial Route

File: `react_agent/react_agent/app/page.tsx`

This page is a redirect controller.

Flow:

1. Wait until `AuthContext` finishes reading local storage.
2. If authenticated, redirect to `/dashboard`.
3. If not authenticated, redirect to `/login`.

The user sees a loading screen while this decision is happening.

### 4.4 Login Page

File: `react_agent/react_agent/app/login/page.tsx`

The login page collects email and password.

Flow:

1. User enters email/password.
2. Frontend sends a form request to:

```text
POST http://localhost:8000/auth/login
Content-Type: application/x-www-form-urlencoded
```

3. Backend returns:

```json
{
  "access_token": "...",
  "token_type": "bearer"
}
```

4. Frontend calls `login(data.access_token)`.
5. Token is saved in localStorage.
6. User is redirected to `/dashboard`.

### 4.5 Signup Page

File: `react_agent/react_agent/app/signup/page.tsx`

The signup page creates a new account.

Flow:

1. User enters email/password.
2. Frontend sends JSON to:

```text
POST http://localhost:8000/auth/signup
Content-Type: application/json
```

3. Backend creates a user and returns an access token.
4. Frontend logs the user in immediately using that token.

### 4.6 Dashboard Page

File: `react_agent/react_agent/app/dashboard/page.tsx`

This is the main application container. It coordinates:

- Sidebar
- Document management view
- Document selection view
- Chat view
- Current chat session ID
- Selected documents
- Messages
- Streaming response handling

Main state:

```ts
activeView: 'home' | 'doc-select' | 'chat'
currentSessionId: string | undefined
selectedDocs: any[]
messages: any[]
inputText: string
isThinking: boolean
allDocs: any[]
```

Dashboard has three main views:

1. `home`
   - Shows uploaded documents through `HomeView`.
   - User can upload, preview, delete, or open chat with a document.

2. `doc-select`
   - Used for starting a new chat.
   - User selects one or more documents.

3. `chat`
   - Shows selected document context.
   - Renders `ChatInterface`.

### 4.7 Sidebar

File: `react_agent/react_agent/components/Sidebar.tsx`

The sidebar provides:

- App branding
- Documents navigation
- New Chat button
- Chat history list
- Logout button

When mounted, it fetches chat sessions:

```text
GET http://localhost:8000/sessions
Authorization: Bearer <token>
```

Each session can be clicked. Clicking a session calls `handleSessionSelect(session.id)` in the dashboard, which loads previous messages from the backend.

### 4.8 HomeView

File: `react_agent/react_agent/components/HomeView.tsx`

This component manages uploaded documents.

Responsibilities:

- Fetch documents from backend.
- Upload one or more files.
- Delete a document.
- Preview document metadata and summary.
- Select documents for a chat.
- Open chat with a specific document.

Document fetch:

```text
GET http://localhost:8000/documents
Authorization: Bearer <token>
```

Upload:

```text
POST http://localhost:8000/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

The upload form sends:

- `files`: one or more uploaded files.
- `overwrite`: currently sent as `"false"` from `HomeView`, so new uploads are appended to the existing vector store.

Delete:

```text
DELETE http://localhost:8000/documents/{doc_id}
Authorization: Bearer <token>
```

Preview panel:

- Shows filename.
- Shows upload date.
- Shows AI-generated summary if available.
- Shows suggested questions if document analysis finished.

### 4.9 ChatInterface

File: `react_agent/react_agent/components/ChatInterface.tsx`

This component renders:

- Chat messages.
- Assistant markdown.
- Code blocks with copy buttons.
- Suggestions parsed from the assistant response.
- Tagged document chips.
- Mention dropdown using `@`.
- Expanding textarea composer.
- Send button.
- Clear chat button.

Message handling is owned by `dashboard/page.tsx`. `ChatInterface` only calls:

```ts
onSendMessage(e?, messageOverride?)
```

The assistant is expected to end some responses with:

```text
Suggestions: [Suggestion 1] | [Suggestion 2] | [Suggestion 3]
```

`ChatInterface` strips that suggestions line from the visible assistant message and renders suggestions as clickable buttons above the composer.

When a user clicks a suggestion, it sends that suggestion as a new chat message.

## 5. Backend Architecture

### 5.1 FastAPI Entry Point

File: `report_debug_agent/app/main.py`

Responsibilities:

- Creates the FastAPI app.
- Initializes database tables using `init_db()`.
- Enables CORS for all origins.
- Includes API routes from `app/api/router.py`.
- Exposes a root health route:

```text
GET /
```

Response:

```json
{
  "message": "Document Analysis Agent API is running"
}
```

### 5.2 API Router

File: `report_debug_agent/app/api/router.py`

It registers:

```text
/auth/*       -> auth.py
/upload       -> upload.py
/documents    -> upload.py
/ask          -> chat.py
/sessions     -> chat.py
```

### 5.3 Configuration

File: `report_debug_agent/app/core/config.py`

Important settings:

```py
UPLOAD_DIR = report_debug_agent/uploads
DB_PATH = report_debug_agent/memory.sqlite
PERSIST_DIR = report_debug_agent/chroma_db
OLLAMA_BASE_URL = http://192.168.1.240:11434
OLLAMA_EMBED_MODEL = nomic-embed-text:latest
OLLAMA_CHAT_MODEL = gemma4:e4b
```

Note:

Some code uses these settings, but some modules also hardcode the Ollama base URL and model names directly.

### 5.4 Database Layer

File: `report_debug_agent/app/db/database.py`

The application uses SQLite through SQLAlchemy.

Database URL:

```py
sqlite:///./app_v2.db
```

This means the metadata database is created relative to the backend process working directory.

Tables:

#### User

Stores registered users.

Fields:

- `id`
- `email`
- `hashed_password`
- `is_active`

Relationships:

- One user has many documents.
- One user has many chat sessions.

#### Document

Stores uploaded document metadata.

Fields:

- `id`
- `filename`
- `file_path`
- `upload_date`
- `owner_id`
- `summary`
- `suggestions`

Important:

The actual file is stored on disk in the upload folder. The extracted chunks are stored in ChromaDB. The SQL table stores metadata, summary, and suggested questions.

#### ChatSession

Stores chat session metadata.

Fields:

- `id`
- `title`
- `created_at`
- `user_id`

The `id` is generated as a UUID.

#### Message

Stores chat messages.

Fields:

- `id`
- `session_id`
- `role`
- `content`
- `timestamp`

Roles are usually:

- `user`
- `agent`

## 6. Authentication Flow

### 6.1 Signup

Endpoint:

```text
POST /auth/signup
```

Backend flow:

1. Receives email/password.
2. Checks if email already exists.
3. Hashes password using bcrypt.
4. Creates a `User` record.
5. Creates a JWT token with subject `sub = user.email`.
6. Returns the token.

### 6.2 Login

Endpoint:

```text
POST /auth/login
```

Backend flow:

1. Receives OAuth2 form fields:
   - `username`
   - `password`
2. Finds user by email.
3. Verifies password.
4. Creates JWT access token.
5. Returns the token.

### 6.3 Protected Routes

Protected routes depend on:

```py
get_current_user()
```

This function:

1. Reads the bearer token.
2. Decodes it using `SECRET_KEY` and `HS256`.
3. Extracts email from the JWT `sub`.
4. Loads the matching user from the database.
5. Rejects the request if token/user is invalid.

Protected endpoints include:

- `/upload`
- `/documents`
- `/documents/{doc_id}`
- `/ask`
- `/sessions`
- `/sessions/{session_id}/messages`

## 7. Document Upload And Indexing Flow

File: `report_debug_agent/app/api/endpoints/upload.py`

Endpoint:

```text
POST /upload
```

Input:

- One or more uploaded files.
- `overwrite` flag.
- Authenticated user.

Backend flow:

1. Receives uploaded files.
2. Saves each file into `settings.UPLOAD_DIR`.
3. Creates a `Document` row in SQLite for each file.
4. Uses `DocumentProcessor` to extract text/tables/OCR content.
5. Starts background analysis with `DocumentAnalyzer`.
6. Commits document metadata to the database.
7. Calls `setup_vector_store(file_paths, overwrite=is_overwrite)`.
8. Returns upload status.

### 7.1 DocumentProcessor

File: `report_debug_agent/app/services/document_processor.py`

This class converts files into LangChain `Document` objects.

Supported processing:

- PDF:
  - Uses `pdfplumber`.
  - Extracts text page by page.
  - Extracts tables page by page.
  - Converts tables to a simple pipe-separated text representation.
  - If no text is found, falls back to OCR via `unstructured`.

- Images:
  - Uses `unstructured.partition` with `hi_res` strategy for OCR.

- Other files:
  - Uses `unstructured.partition.auto.partition`.

Each extracted element becomes a LangChain `Document` with:

- `page_content`
- metadata such as source path, page number, and content type.

### 7.2 Vector Store Creation

File: `report_debug_agent/rag/vector_store.py`

Function:

```py
setup_vector_store(file_paths, overwrite=True)
```

Flow:

1. Processes files using `DocumentProcessor`.
2. Splits extracted text into chunks using `RecursiveCharacterTextSplitter`.
3. Chunk settings:
   - `chunk_size = 1200`
   - `chunk_overlap = 200`
   - `add_start_index = True`
4. Adds simple entity relationships to the knowledge graph.
5. Creates Ollama embeddings using:
   - model: `nomic-embed-text:latest`
   - base URL: `http://192.168.1.240:11434`
6. Stores chunks in ChromaDB.
7. Creates a retriever with:
   - `k = 7`
8. Saves this retriever in a module-level global variable `_retriever`.

If `overwrite=True`, the old Chroma directory is deleted and rebuilt.

If `overwrite=False`, new documents are added to the existing Chroma store.

### 7.3 Knowledge Graph Creation

File: `report_debug_agent/rag/graph_store.py`

The project also builds a lightweight knowledge graph.

Current implementation:

- Uses networkx.
- Extracts entities using a simple regex for capitalized words.
- Adds chunk nodes.
- Adds entity nodes.
- Connects chunks to extracted entities.
- Persists graph to:

```text
report_debug_agent/knowledge_graph.json
```

This graph is simple and useful for demonstrating agentic extension, but it is not a deep semantic graph yet.

### 7.4 Background Document Analysis

File: `report_debug_agent/app/services/analyzer.py`

After upload, the backend starts a background analysis task.

The analyzer:

1. Takes the first 4000 characters of extracted text.
2. Sends a prompt to the Ollama LLM.
3. Asks for:
   - a max 3 sentence summary
   - three suggested questions
4. Parses JSON from the model response.
5. Stores `summary` and `suggestions` in the `documents` table.

Frontend uses this metadata in the document cards and preview panel.

## 8. Chat And Agent Flow

### 8.1 Frontend Send Flow

File: `react_agent/react_agent/app/dashboard/page.tsx`

Function:

```ts
handleSendMessage(e?, messageOverride?)
```

Flow:

1. Get user message from:
   - typed input, or
   - clicked suggestion.
2. Ignore empty messages.
3. Clear input.
4. Add user message to local UI state immediately.
5. Set `isThinking = true`.
6. POST to backend:

```text
POST http://localhost:8000/ask
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "question": "user question",
  "thread_id": "current session id or null"
}
```

7. Read `X-Session-ID` response header.
8. If this is a new chat, save that session ID.
9. Read the response body stream token by token.
10. First streamed token creates an assistant message.
11. Later streamed tokens update the last assistant message.

### 8.2 Backend Ask Endpoint

File: `report_debug_agent/app/api/endpoints/chat.py`

Endpoint:

```text
POST /ask
```

Backend flow:

1. Checks that a vector retriever exists.
2. If no retriever is available, returns:

```text
Vector store not initialized. Please upload a document first.
```

3. Creates a new chat session if `thread_id` is missing.
4. Saves the user message to the `messages` table.
5. Gets current user's document filenames.
6. Appends system info to the question:

```text
[SYSTEM INFO] Currently loaded documents for user: ...
```

7. Calls:

```py
run_agent_stream(question + file_context, thread_id=session_id)
```

8. Streams tokens back as plain text.
9. After streaming finishes, saves the full assistant response to the database.

Response includes:

```text
X-Session-ID: <session_id>
```

This allows the frontend to persist the session ID.

### 8.3 Agent Execution

File: `report_debug_agent/agent/agent.py`

The agent is built using LangGraph:

```py
create_react_agent(
    model=llm,
    tools=TOOLS,
    prompt=system_prompt,
    checkpointer=saver
)
```

Model:

```py
ChatOllama(
    base_url="http://192.168.1.240:11434",
    model="gemma4:e4b",
    temperature=0
)
```

The agent uses:

- A system prompt from `configs/system_prompt.txt`.
- Tools from `configs/tools_config.py`.
- SQLite checkpointer from LangGraph.
- Thread ID equal to the chat session ID.

The thread ID lets LangGraph preserve conversation memory per chat.

### 8.4 Streaming

The backend uses:

```py
agent_executor.astream_events(...)
```

It listens for:

```py
on_chat_model_stream
```

When model chunks arrive, it yields the text content to FastAPI's `StreamingResponse`.

The frontend reads this through:

```ts
res.body?.getReader()
```

This gives the user a live typing/streaming experience.

## 9. Agent Tools

Tools are registered in:

```text
report_debug_agent/configs/tools_config.py
```

### 9.1 search_document

File: `tools/document_search.py`

Purpose:

- General document question answering.
- Retrieves top relevant chunks from ChromaDB.

Flow:

1. Gets retriever from `get_retriever()`.
2. Runs `retriever.invoke(query)`.
3. Formats each chunk with source filename.
4. Returns relevant snippets to the agent.

### 9.2 summarize_document

File: `tools/summarize_document.py`

Purpose:

- Used when the user asks for a summary, overview, or broad explanation.

Flow:

1. Gets retriever.
2. Performs similarity search with `k=5`.
3. Returns relevant chunks for the LLM to summarize.

### 9.3 compare_documents

File: `tools/compare_documents.py`

Purpose:

- Used when the user asks to compare, contrast, or find differences between specific documents.

Inputs:

- `query`
- `document_names`

Flow:

1. Gets vector store from retriever.
2. Searches per document name.
3. Attempts Chroma metadata filtering.
4. Falls back to manual filtering if needed.
5. Returns grouped content by document.

### 9.4 graph_search

File: `tools/graph_search.py`

Purpose:

- Searches related graph entities and conceptual connections.

Current limitation:

- It searches exact query text as an entity.
- The entity extraction is regex-based, so graph search is useful as a demonstration but not yet robust.

## 10. System Prompt Behavior

File: `report_debug_agent/configs/system_prompt.txt`

The system prompt defines:

- The assistant identity: Document Analysis Agent.
- Markdown formatting rules.
- Tool usage guidelines.
- Memory behavior.
- Suggestion output format.

Important response requirements:

- Use plain markdown.
- Do not wrap full responses in code blocks.
- Mention referenced documents.
- Use `search_document` for general queries.
- Use `compare_documents` for comparisons.
- End useful responses with:

```text
Suggestions: [Suggestion 1] | [Suggestion 2] | [Suggestion 3]
```

Frontend depends on this exact suggestions format.

## 11. Chat History Flow

Chat history is stored in two places:

### 11.1 Application Message Table

The `messages` table stores frontend-visible chat messages.

Used by:

```text
GET /sessions
GET /sessions/{session_id}/messages
```

This is what the Sidebar and Dashboard use.

### 11.2 LangGraph Checkpointer

LangGraph also stores agent state in:

```text
report_debug_agent/memory.sqlite
```

This is used internally by the agent so follow-up questions can use memory.

The file `app/history_manager.py` can read LangGraph checkpoint sessions, but the current active chat APIs use the SQLAlchemy `ChatSession` and `Message` tables instead.

## 12. End-To-End User Journey

### Journey 1: New User Signup

1. User opens app.
2. `app/page.tsx` checks auth state.
3. User is redirected to `/login` or goes to `/signup`.
4. Signup sends email/password to backend.
5. Backend hashes password and creates user.
6. Backend returns JWT.
7. Frontend stores JWT.
8. User lands on dashboard.

### Journey 2: Upload Document

1. User clicks Upload Files in `HomeView`.
2. Browser sends multipart files to `/upload`.
3. Backend saves files to disk.
4. Backend creates `Document` rows.
5. Backend extracts text/tables/OCR.
6. Backend starts document summary/suggestion analysis.
7. Backend chunks text.
8. Backend embeds chunks using Ollama.
9. Backend writes chunks to ChromaDB.
10. Backend updates retriever.
11. Frontend refetches documents.
12. Document appears in dashboard.

### Journey 3: Chat With Document

1. User opens chat with selected document.
2. User asks a question.
3. Frontend adds user message locally.
4. Frontend calls `/ask`.
5. Backend creates session if needed.
6. Backend saves user message.
7. Backend calls LangGraph agent.
8. Agent decides which tool to call.
9. Tool retrieves document chunks from ChromaDB.
10. Agent generates answer grounded in retrieved text.
11. Backend streams answer tokens.
12. Frontend updates assistant message live.
13. Backend stores final assistant response.
14. Sidebar can later reload the session.

## 13. How RAG Works In This Project

RAG means Retrieval-Augmented Generation.

This project's RAG pipeline is:

1. Document ingestion
   - Uploaded files are saved.
   - Text, tables, and OCR content are extracted.

2. Chunking
   - Extracted content is split into overlapping chunks.
   - Chunk size is 1200 characters.
   - Chunk overlap is 200 characters.

3. Embedding
   - Each chunk is converted into a vector using `nomic-embed-text:latest`.

4. Storage
   - Vectors and metadata are stored in ChromaDB.

5. Retrieval
   - User query is embedded.
   - Similar chunks are retrieved from ChromaDB.

6. Tool use
   - The LangGraph agent calls tools like `search_document`.

7. Generation
   - The LLM uses retrieved chunks to produce a final answer.

8. Streaming
   - Tokens are streamed back to the UI.

## 14. Why This Is Agentic AI

This is more than a simple "prompt + context" chatbot because it uses an agent loop.

Agentic behavior:

- The LLM is wrapped in a LangGraph ReAct agent.
- The agent can choose tools.
- The agent can search documents.
- The agent can compare documents.
- The agent has per-thread memory through the checkpointer.
- The agent follows a system prompt and decides how to answer.

The conceptual loop is:

```text
User question
  -> LLM reasons
  -> Agent selects tool
  -> Tool retrieves external evidence
  -> LLM observes tool result
  -> LLM produces final answer
```

This helps reduce hallucination because the model can ground answers in retrieved document chunks.

## 15. Important Files To Explain In Interviews

### Frontend

- `app/layout.tsx`
  - Wraps app in `AuthProvider`.

- `context/AuthContext.tsx`
  - Stores JWT auth state on the frontend.

- `app/page.tsx`
  - Redirects user based on auth state.

- `app/login/page.tsx`
  - Login form and token handling.

- `app/signup/page.tsx`
  - Signup form and immediate login.

- `app/dashboard/page.tsx`
  - Main orchestrator for documents, chat state, session state, and streaming.

- `components/HomeView.tsx`
  - Document upload, listing, selection, preview, and deletion.

- `components/Sidebar.tsx`
  - Navigation and chat history.

- `components/ChatInterface.tsx`
  - Chat UI, markdown rendering, suggestions, mentions, and input composer.

### Backend

- `app/main.py`
  - FastAPI setup and route registration.

- `app/api/endpoints/auth.py`
  - Signup, login, current user dependency.

- `app/api/endpoints/upload.py`
  - Upload, document listing, document deletion.

- `app/api/endpoints/chat.py`
  - Sessions, messages, `/ask`, streaming response.

- `app/db/database.py`
  - SQLAlchemy models and DB setup.

- `app/services/document_processor.py`
  - PDF/text/table/OCR extraction.

- `app/services/analyzer.py`
  - Background summary and question suggestion generation.

- `rag/vector_store.py`
  - Chunking, embeddings, ChromaDB, retriever.

- `rag/graph_store.py`
  - Lightweight knowledge graph.

- `agent/agent.py`
  - LangGraph ReAct agent and streaming.

- `tools/*.py`
  - Agent tools.

- `configs/system_prompt.txt`
  - Agent behavior and formatting instructions.

## 16. API Summary

### Auth

```text
POST /auth/signup
```

Creates a user and returns JWT.

```text
POST /auth/login
```

Validates credentials and returns JWT.

### Documents

```text
POST /upload
```

Uploads and indexes documents.

```text
GET /documents
```

Lists current user's documents.

```text
DELETE /documents/{doc_id}
```

Deletes document metadata and uploaded file.

### Chat

```text
GET /sessions
```

Lists chat sessions for current user.

```text
GET /sessions/{session_id}/messages
```

Loads previous messages for a session.

```text
POST /ask
```

Runs the agent and streams the response.

## 17. Data Storage Summary

### SQLite `app_v2.db`

Stores:

- Users
- Documents
- Chat sessions
- Chat messages

### ChromaDB `chroma_db`

Stores:

- Document chunks
- Embeddings
- Chunk metadata

### `uploads/`

Stores:

- Original uploaded files.

### `knowledge_graph.json`

Stores:

- Lightweight graph of chunk/entity relationships.

### `memory.sqlite`

Stores:

- LangGraph checkpoint memory per thread/session.

## 18. Current Limitations And Improvement Areas

These are useful to mention in interviews because they show you understand the project deeply.

### 18.1 Hardcoded Backend URLs

Frontend calls:

```text
http://localhost:8000
```

directly in multiple files.

Improvement:

- Move API base URL into `.env.local`.
- Use a centralized API client.

### 18.2 Hardcoded Ollama URL And Models

Backend hardcodes:

```text
http://192.168.1.240:11434
gemma4:e4b
nomic-embed-text:latest
```

Improvement:

- Use `settings.OLLAMA_BASE_URL`, `settings.OLLAMA_CHAT_MODEL`, and `settings.OLLAMA_EMBED_MODEL` everywhere.

### 18.3 Secret Key Is Not Production Safe

File:

```text
app/core/security.py
```

Current secret:

```py
SECRET_KEY = "your-secret-key-change-this-in-production"
```

Improvement:

- Load `SECRET_KEY` from environment variables.

### 18.4 Document Selection Is Mostly UI Context

The frontend shows selected documents, but `/ask` currently searches the global user's vector store rather than strictly filtering retrieval by selected document IDs.

Improvement:

- Send selected document IDs to `/ask`.
- Filter Chroma retrieval by selected document metadata.

### 18.5 Vector Store Is Global

The retriever is a module-level global variable. It can load persisted Chroma data, but it is not strongly isolated per user.

Improvement:

- Store user ID in chunk metadata.
- Filter retrieval by user ID.
- Consider per-user collections or per-user metadata filters.

### 18.6 Delete Does Not Remove Chroma Chunks

Deleting a document removes the SQL row and physical file, but does not remove that document's chunks from ChromaDB.

Improvement:

- Store document ID in vector metadata.
- Delete vectors by document ID.

### 18.7 Knowledge Graph Is Basic

The graph uses regex-based capitalized word extraction.

Improvement:

- Use NER or LLM-based entity extraction.
- Store richer relationships.
- Add graph retrieval with fuzzy matching.

### 18.8 Frontend User Object Is Placeholder

Frontend stores:

```ts
{ email: 'user@example.com' }
```

Improvement:

- Return user details from backend.
- Add `/auth/me`.
- Decode JWT or fetch profile after login.

### 18.9 Lint Issues Exist

The project currently has TypeScript/ESLint warnings and errors, mostly around:

- `any` types
- React hook dependencies
- unused variables
- synchronous state calls inside effects

Improvement:

- Add proper interfaces for API responses.
- Refactor effects with stable callbacks.
- Clean unused variables.

## 19. How To Run The Project

### 19.1 Backend

From:

```text
report_debug_agent
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run FastAPI:

```bash
python run.py
```

or:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend URL:

```text
http://localhost:8000
```

### 19.2 Frontend

From:

```text
react_agent/react_agent
```

Install dependencies:

```bash
npm install
```

Run Next.js:

```bash
npm run dev
```

Frontend URL:

```text
http://localhost:3000
```

Note on Windows PowerShell:

If `npm` is blocked by execution policy, use:

```bash
npm.cmd run dev
```

## 20. Interview-Ready Explanation

You can explain the project like this:

"I built a full-stack Agentic AI document analysis application. The frontend is a Next.js app with authentication, document upload, document management, chat history, and a streaming chat interface. The backend is built with FastAPI and uses JWT authentication, SQLite for user/document/session metadata, ChromaDB for vector search, and LangGraph for the agentic workflow.

When a user uploads a document, the backend extracts text, tables, and OCR content using pdfplumber and unstructured. The extracted content is chunked with overlap, embedded using an Ollama embedding model, and stored in ChromaDB. A background analyzer also generates a summary and suggested questions.

When the user asks a question, the frontend sends it to the `/ask` endpoint. The backend creates or reuses a chat session, saves the user message, and runs a LangGraph ReAct agent. The agent can call tools like document search, summarization, comparison, and graph search. The document search tool retrieves relevant chunks from ChromaDB, and the LLM uses that retrieved evidence to generate a grounded answer. The response is streamed token by token back to the frontend, where the chat UI updates live.

The system also stores chat messages and sessions in SQLite, while LangGraph uses its own SQLite checkpoint memory so follow-up questions can use previous context."

## 21. Quick Architecture Diagram

```text
User
  |
  v
Next.js Frontend
  |
  |-- Auth requests --> FastAPI /auth
  |-- Upload files --> FastAPI /upload
  |-- Ask question --> FastAPI /ask
  |
  v
FastAPI Backend
  |
  |-- SQLAlchemy --> SQLite app_v2.db
  |-- File save --> uploads/
  |-- DocumentProcessor --> extracted LangChain Documents
  |-- TextSplitter --> chunks
  |-- Ollama embeddings --> vectors
  |-- ChromaDB --> persistent vector store
  |-- LangGraph ReAct Agent
        |
        |-- search_document
        |-- summarize_document
        |-- compare_documents
        |-- graph_search
        |
        v
      Ollama Chat Model
        |
        v
StreamingResponse
  |
  v
Frontend Chat UI
```

## 22. One-Line Summary

This project is a RAG-based Agentic AI document assistant where uploaded documents are processed into a searchable vector knowledge base, and a LangGraph tool-using agent retrieves evidence from that knowledge base to answer user questions through a streaming chat interface.
