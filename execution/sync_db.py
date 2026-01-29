import os
import argparse
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def sync_db(schema_file):
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
        return

    print(f"Connecting to Supabase at {SUPABASE_URL}...")
    
    # Initialize Supabase client
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Error initializing client: {e}")
        return

    # Read Schema File
    if not os.path.exists(schema_file):
        print(f"Error: Schema file '{schema_file}' not found.")
        return

    try:
        with open(schema_file, 'r') as f:
            sql_content = f.read()

        # Split generic SQL statements (Basic parsing)
        # Note: This is a simplified execution. For complex migrations, use a proper migration tool.
        statements = sql_content.split(';')
        
        print(f"Found {len(statements)} statements to execute.")

        for statement in statements:
            if statement.strip():
                # Execute using rpc or direct query if available in client/library
                # Note: supabase-py client mainly interacts via PostgREST. 
                # For DDL (CREATE TABLE), we often need the direct SQL editor or a Postgres connection (psycopg2).
                # However, for this 'Agent Skill', we will attempt to use the `rpc` function `execute_sql` if it exists,
                # or warn the user that they might need to use the dashboard or a direct PG connection.
                
                # IMPORTANT: Standard supabase-js/py clients don't support raw SQL execution for security.
                # We will simulate the 'Skill' verifying dependencies, and here we flag that use of `psycopg2` 
                # or the Supabase Management API would be better.
                # For now, we will just PRINT what would be executed to simulate the "dry run".
                
                print(f"[DRY RUN] Executing SQL: {statement.strip()[:50]}...")
                
        print("Schema sync check complete (Dry Run). Real generic SQL execution requires Postgres connection.")

    except Exception as e:
        print(f"Error reading/executing schema: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync Supabase Database Schema")
    parser.add_argument("--schema", default="supabase/schema.sql", help="Path to schema file")
    parser.add_argument("--op", default="sync", help="Operation: sync or check")
    
    args = parser.parse_args()
    
    sync_db(args.schema)
