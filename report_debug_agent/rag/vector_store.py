import os
import shutil
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_ollama import OllamaEmbeddings
from app.services.document_processor import DocumentProcessor

load_dotenv()

_retriever = None

def setup_vector_store(file_paths: list[str], overwrite: bool = True):
    """
    Loads documents using advanced processor, splits them into chunks, and stores them in ChromaDB.
    """
    global _retriever
    
    all_docs = []
    processor = DocumentProcessor()
    
    for file_path in file_paths:
        print(f"Processing document: {file_path}")
        try:
            docs = processor.process_document(file_path)
            if not docs:
                print(f"Warning: Failed to extract content from {file_path}.")
                continue
            all_docs.extend(docs)
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            
    if not all_docs:
        if not overwrite and _retriever:
            return _retriever
        raise ValueError(f"Failed to load any readable text from the provided files.")
    
    print(f"Documents processed. Splitting {len(all_docs)} elements into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1200,
        chunk_overlap=200,
        add_start_index=True
    )   
    splits = text_splitter.split_documents(all_docs)
    
    # Populate Knowledge Graph
    from rag.graph_store import knowledge_graph
    for i, split in enumerate(splits):
        chunk_id = f"chunk_{i}"
        knowledge_graph.add_entities_from_text(split.page_content, split.metadata.get("source", "unknown"), chunk_id)
    knowledge_graph.save()
        base_url="http://192.168.1.240:11434",
        model="nomic-embed-text:latest"
    )
    
    persist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chroma_db")
    
    if overwrite and os.path.exists(persist_dir):
        try:
            shutil.rmtree(persist_dir)
            print(f"Cleared previous vector store.")
        except Exception as e:
            print(f"Warning: Could not clear directory: {e}")

    if not overwrite and os.path.exists(persist_dir):
        vectorstore = Chroma(persist_directory=persist_dir, embedding_function=embeddings)
        vectorstore.add_documents(documents=splits)
    else:
        vectorstore = Chroma.from_documents(
            documents=splits, 
            embedding=embeddings,
            persist_directory=persist_dir
        )

    _retriever = vectorstore.as_retriever(search_kwargs={"k": 7}) # Increased k for better coverage
    print("Vector store updated.")
    return _retriever

def get_retriever():
    return _retriever