import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rag.vector_store import setup_vector_store
from agent.agent import run_agent

def main():
    print("="*50)
    print("Welcome to the Document Analysis Agent!")
    print("="*50)
    
    file_path = input("\nEnter the path to the document you want to analyze (e.g., sample.pdf):\n> ")
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found.")
        return
        
    print(f"\n[System] Setting up the knowledge base with {os.path.basename(file_path)}. This might take a moment...")
    try:
        retriever = setup_vector_store([file_path])
        docs = retriever.invoke(" ")
        if docs:
            print(f"\n[System Verification] Successfully indexed document. Sample phrase: '{docs[0].page_content[:60]}...'")
    except Exception as e:
        print(f"Error setting up vector store: {e}")
        return

        
    print("\n[System] Ready! You can now ask questions about the document or ask for suggestions.")
    print("Type 'exit' or 'quit' to end the session.\n")
    
    thread_id = "session_1"
    
    while True:
        user_input = input("You: ")
        
        if user_input.lower() in ['exit', 'quit']:
            print("Session ended. Goodbye!")
            break
            
        if not user_input.strip():
            continue
            
        print("Agent thinking...")
        try:
            response = run_agent(user_input, thread_id=thread_id)
            print(f"\nAgent:\n{response}\n")
            print("-" * 50)
        except Exception as e:
            print(f"An error occurred during agent execution: {e}")

if __name__ == "__main__":
    main()
