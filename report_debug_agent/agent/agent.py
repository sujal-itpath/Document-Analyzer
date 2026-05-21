import os
from dotenv import load_dotenv
from langchain_ollama import ChatOllama
from langgraph.prebuilt import create_react_agent
from configs.tools_config import TOOLS
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

load_dotenv()

# Using local Ollama endpoint for chat
llm = ChatOllama(
    base_url="http://192.168.1.240:11434",
    model="gemma4:e4b",  # Updated to available model
    temperature=0
)



prompt_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "configs", "system_prompt.txt")
with open(prompt_path, "r", encoding="utf-8") as f:
    system_prompt = f.read()

db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "memory.sqlite")

async def run_agent_stream(user_input: str, thread_id: str = "1"):
    """
    Asynchronous generator that yields tokens from the agent's response.
    """
    config = {"configurable": {"thread_id": thread_id}} 
    inputs = {"messages": [("user", user_input)]}
    
    async with AsyncSqliteSaver.from_conn_string(db_path) as saver:
        agent_executor = create_react_agent(
            model=llm,
            tools=TOOLS,
            prompt=system_prompt,
            checkpointer=saver
        )
        # Using astream_events to get granular token streaming
        async for event in agent_executor.astream_events(inputs, config=config, version="v2"):
            kind = event["event"]
            
            # We only want to stream tokens from the 'agent' node's chat model
            if kind == "on_chat_model_stream":
                content = event["data"]["chunk"].content
                if content:
                    if isinstance(content, str):
                        yield content
                    elif isinstance(content, list):
                        for part in content:
                            if isinstance(part, dict) and 'text' in part:
                                yield part['text']
                            elif isinstance(part, str):
                                yield part