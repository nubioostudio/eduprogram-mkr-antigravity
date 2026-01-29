---
description: Manage Supabase database migrations and schema synchronization.
---

# Directive: Manage Database

## Goal
Manage the Supabase database schema, ensuring that local changes are safely applied to the remote project.

## Inputs
- **SchemaFile**: Path to the SQL schema file (default: `supabase/schema.sql`).
- **Operation**: `sync` (apply schema) or `check` (verify connection).

## Tools & Scripts
- **Script**: `execution/sync_db.py`
  - **Command**: `python execution/sync_db.py --schema <SchemaFile> --op <Operation>`
  - **Dependencies**: `supabase`, `python-dotenv`

## Process
1.  **Environment Check**: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist in `.env`.
2.  **Schema Read**: Read the content of the SQL file.
3.  **Execute**: Run the Python script to execute the raw SQL against Supabase.
4.  **Verify**: The script checks for API errors and confirms execution.

## Outputs
- **Status**: Success/Failure message.
- **Logs**: Execution logs of SQL statements.

## Error Handling
- Connection errors: Check `.env` vars.
- SQL Syntax errors: Halt execution and report line number if possible.
