import sqlite3
import json
import os

db_path = os.path.join(os.path.dirname(__file__), "memory.sqlite")
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Get the most recent checkpoints
cursor.execute("SELECT thread_id, checkpoint_id, checkpoint FROM checkpoints ORDER BY thread_id DESC, checkpoint_id DESC LIMIT 5")
rows = cursor.fetchall()

print("MOST RECENT CHECKPOINTS:")
for row in rows:
    print(f"\n--- Thread: {row['thread_id']} | Checkpoint ID: {row['checkpoint_id']} ---")
    try:
        # Checkpoint is usually a pickle or json. If it's pickle, we can't easily print it in python without langgraph.
        # But langgraph sqlite checkpointer saves it as bytes.
        checkpoint_data = row['checkpoint']
        print(f"Data size: {len(checkpoint_data)} bytes")
    except Exception as e:
        print(f"Error parsing checkpoint: {e}")

# Let's try to query the writes table to see the actual messages
cursor.execute("SELECT thread_id, task_id, idx, channel, value FROM writes ORDER BY rowid DESC LIMIT 10")
writes = cursor.fetchall()

print("\nMOST RECENT WRITES (Messages):")
for w in writes:
    print(f"\n--- Thread: {w['thread_id']} | Channel: {w['channel']} ---")
    try:
        # value is typically json or pickled
        val = w['value']
        print(f"Raw value bytes preview: {val[:200]}")
    except Exception as e:
        print(f"Error reading value: {e}")

conn.close()