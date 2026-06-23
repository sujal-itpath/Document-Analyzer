import os
from dotenv import load_dotenv
from app.core.llm_factory import get_chat_model
from langgraph.prebuilt import create_react_agent
from configs.tools_config import TOOLS
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

load_dotenv()
from app.core.config import settings

llm = get_chat_model(temperature=0)

_prompt_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "configs",
    "system_prompt.txt",
)
with open(_prompt_path, "r", encoding="utf-8") as f:
    _base_system_prompt = f.read()

db_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "memory.sqlite",
)


async def run_agent_stream(user_input: str, thread_id: str = "1", user_id: int | None = None):
    """
    Asynchronous generator that yields tokens from the agent's response.

    Parameters
    ----------
    user_input : the user's message (may include injected file context)
    thread_id  : LangGraph checkpoint thread — unique per chat session
    user_id    : the authenticated user's database ID, injected into context
                 vars so recall_memory tool can access the right collection
    """
    # ── Inject user_id into context var for recall_memory tool ───────────────
    token = None
    if user_id is not None:
        from tools.recall_memory import set_current_user_id, reset_current_user_id
        token = set_current_user_id(user_id)

    config = {"configurable": {"thread_id": thread_id}}
    inputs = {"messages": [("user", user_input)]}

    try:
        async with AsyncSqliteSaver.from_conn_string(db_path) as saver:
            agent_executor = create_react_agent(
                model=llm,
                tools=TOOLS,
                prompt=_base_system_prompt,
                checkpointer=saver,
            )
            async for event in agent_executor.astream_events(inputs, config=config, version="v2"):
                kind = event["event"]
                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        if isinstance(content, str):
                            yield content
                        elif isinstance(content, list):
                            for part in content:
                                if isinstance(part, dict) and "text" in part:
                                    yield part["text"]
                                elif isinstance(part, str):
                                    yield part
    finally:
        if token is not None:
            from tools.recall_memory import reset_current_user_id
            reset_current_user_id(token)