# EduProgram Worker Service

Worker service for processing large PDF documents with Gemini AI. This service runs independently from Supabase Edge Functions to avoid memory limitations.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Fill in your environment variables in `.env`

4. Run locally:
```bash
npm run dev
```

## Deployment to Railway

1. Push this code to your Git repository
2. Create a new project in Railway
3. Connect your repository
4. Add environment variables in Railway dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
5. Railway will auto-deploy

## API Endpoints

### POST /process-document
Process a PDF document from Supabase Storage.

**Request Body:**
```json
{
  "document_id": "uuid",
  "storage_path": "path/to/file.pdf"
}
```

**Response:**
```json
{
  "message": "Processing started",
  "document_id": "uuid"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-29T17:00:00.000Z"
}
```
