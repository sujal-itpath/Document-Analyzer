import os
import shutil
from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

load_dotenv()

_retriever = None

def setup_vector_store(file_paths: list[str]):
    """
    Loads documents, splits them into chunks, and stores them in ChromaDB.
    Returns a retriever object.
    """
    global _retriever
    
    all_docs = []
    for file_path in file_paths:
        print(f"Loading document: {file_path}")
        
        if file_path.endswith('.pdf'):
            loader = PyPDFLoader(file_path)
        else:
            loader = TextLoader(file_path, encoding='utf-8')
            
        docs = loader.load()
        if not docs:
            print(f"Warning: Failed to load any readable text from {file_path}.")
            continue
        all_docs.extend(docs)
        
    if not all_docs:
        raise ValueError(f"Failed to load any readable text from the provided files.")
    
    print(f"Documents loaded. Splitting into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        add_start_index=True
    )   
    splits = text_splitter.split_documents(all_docs)
    if not splits:
        raise ValueError(f"Failed to generate chunks from the documents.")
    
    print(f"Created {len(splits)} chunks. Initializing Google Generative AI Embeddings and ChromaDB...")
    
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
    
    persist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db")
    
    if os.path.exists(persist_dir):
        try:
            shutil.rmtree(persist_dir)
            print(f"Cleared previous vector store at {persist_dir} to start fresh.")
        except Exception as e:
            print(f"Warning: Could not clear previous vector store: {e}")

    vectorstore = Chroma.from_documents(
        documents=splits, 
        embedding=embeddings,
        persist_directory=persist_dir
    )

    _retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
     
    print("Vector store setup complete (Cloud Embeddings).")
    return _retriever

def get_retriever():
    "Returns the currently active retriever."
    return _retriever 