import os
import sqlite3
import json
from typing import List, Dict, Any
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

class HistoryManager:
    def __init__(self, db_path: str):
        self.db_path = db_path

    async def get_all_sessions(self) -> List[Dict[str, Any]]:
        """Fetch all unique thread IDs and their last update time."""
        sessions = []
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            # Query unique thread IDs from checkpoints
            cursor.execute("""
                SELECT thread_id, MAX(checkpoint_id) as last_checkpoint 
                FROM checkpoints 
                GROUP BY thread_id 
                ORDER BY last_checkpoint DESC
            """)
            rows = cursor.fetchall()
            for row in rows:
                sessions.append({
                    "thread_id": row[0],
                    "title": f"Chat {row[0][:8]}..." if len(row[0]) > 8 else f"Chat {row[0]}"
                })
            conn.close()
        except Exception as e:
            print(f"Error fetching sessions: {e}")
        return sessions

    async def get_session_messages(self, thread_id: str) -> List[Dict[str, Any]]:
        """Fetch all messages for a specific session using AsyncSqliteSaver."""
        messages = []
        async with AsyncSqliteSaver.from_conn_string(self.db_path) as saver:
            config = {"configurable": {"thread_id": thread_id}}
            checkpoint_tuple = await saver.aget_tuple(config)
            if checkpoint_tuple:
                checkpoint = checkpoint_tuple.checkpoint
                # The 'messages' key usually contains the conversation
                if "channel_values" in checkpoint and "messages" in checkpoint["channel_values"]:
                    msgs = checkpoint["channel_values"]["messages"]
                    for msg in msgs:
                        # LangChain messages have 'type' and 'content'
                        role = "user" if msg.type == "human" else "agent"
                        content = msg.content
                        if isinstance(content, list):
                            text_parts = []
                            for part in content:
                                if isinstance(part, dict) and 'text' in part:
                                    text_parts.append(part['text'])
                                elif isinstance(part, str):
                                    text_parts.append(part)
                            content = "".join(text_parts)
                        
                        messages.append({
                            "role": role,
                            "content": str(content)
                        })
        return messages
# Initialize with the correct DB path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "memory.sqlite")
history_manager = HistoryManager(DB_PATH)