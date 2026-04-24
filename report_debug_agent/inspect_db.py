import sqlite3
import os

db_path = "memory.sqlite"

if not os.path.exists(db_path):
    print(f"Database file '{db_path}' not found. Run the agent first to initialize it.")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # List tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        if not tables:
            print("Database exists but contains no tables yet.")
        else:
            print(f"Found {len(tables)} tables: {[t[0] for t in tables]}")
            for table in tables:
                table_name = table[0]
                cursor.execute(f"PRAGMA table_info({table_name});")
                schema = cursor.fetchall()
                print(f"\n--- Schema for table: {table_name} ---")
                for col in schema:
                    print(f"  Column: {col[1]} ({col[2]})")
                
                # Show row count
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                print(f"  Total records: {count}")

        conn.close()
    except Exception as e:
        print(f"Error inspecting database: {e}")