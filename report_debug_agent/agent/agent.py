import os
import ast
import sqlite3
import json
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from configs.tools_config import TOOLS
from langgraph.checkpoint.sqlite import SqliteSaver

load_dotenv()

llm = ChatGoogleGenerativeAI(
    model="gemini-flash-latest", 
    temperature=0,
)

prompt_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "configs", "system_prompt.txt")
with open(prompt_path, "r", encoding="utf-8") as f:
    system_prompt = f.read()

db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "memory.sqlite")
conn = sqlite3.connect(db_path, check_same_thread=False)
memory = SqliteSaver(conn)
memory.setup()

agent_executor = create_react_agent(    
    model=llm,
    tools=TOOLS,
    prompt=system_prompt,
    checkpointer=memory
)

def run_agent(user_input: str, thread_id: str = "1"):
    """
    Runs the agent and returns the final cleaned response text.
    """
    config = {"configurable": {"thread_id": thread_id}} 
    inputs = {"messages": [("user", user_input)]}
    
    response = agent_executor.invoke(inputs, config=config)
    final_message = response["messages"][-1].content
    
    if isinstance(final_message, list):
        text_parts = []
        for part in final_message:
            if isinstance(part, dict) and 'text' in part:
                text_parts.append(part['text'])
            elif isinstance(part, str):
                text_parts.append(part)
        if text_parts:
            return "".join(text_parts).strip()
    
    if isinstance(final_message, str) and (final_message.strip().startswith('[') or final_message.strip().startswith('{')):
        parsed = None
        try:
            parsed = json.loads(final_message)
        except (json.JSONDecodeError, TypeError):
            try:
                parsed = ast.literal_eval(final_message)
            except (ValueError, SyntaxError):
                pass
        
        if parsed:
            if isinstance(parsed, list):
                text_parts = []
                for part in parsed:
                    if isinstance(part, dict) and 'text' in part:
                        text_parts.append(part['text'])
                    elif isinstance(part, str):
                        text_parts.append(part)
                if text_parts:
                    return "".join(text_parts).strip()
            elif isinstance(parsed, dict) and 'text' in parsed:
                return str(parsed['text']).strip()
    
    return final_message