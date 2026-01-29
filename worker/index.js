import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper to update document progress
async function updateProgress(documentId, stage, message) {
    console.log(`[${new Date().toISOString()}] ${documentId}: ${stage} - ${message}`);
    await supabase.from('documents').update({
        status: 'processing',
        metadata: { stage, message, updated_at: new Date().toISOString() }
    }).eq('id', documentId);
}

// Main processing endpoint
app.post('/process-document', async (req, res) => {
    const { document_id, storage_path } = req.body;

    if (!document_id || !storage_path) {
        return res.status(400).json({ error: 'Missing document_id or storage_path' });
    }

    // Respond immediately to avoid timeout
    res.status(202).json({ message: 'Processing started', document_id });

    // Process asynchronously
    processDocument(document_id, storage_path).catch(err => {
        console.error(`Error processing ${document_id}:`, err);
    });
});

async function processDocument(documentId, storagePath) {
    try {
        await updateProgress(documentId, 'starting', 'Iniciando análisis...');

        // 1. Download PDF from Supabase Storage
        await updateProgress(documentId, 'downloading', 'Descargando PDF desde storage...');
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('documents')
            .download(storagePath);

        if (downloadError) throw downloadError;

        // 2. Convert to Base64
        await updateProgress(documentId, 'extracting', 'Preparando documento para análisis...');
        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        // 3. Call Gemini 1.5 Flash (stable model)
        await updateProgress(documentId, 'gemini_call', 'Analizando con Gemini AI...');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `
      Eres un experto en análisis de catálogos educativos.
      Analiza el siguiente documento PDF (enviado como base64).
      
      OBJETIVO: Identificar de forma rápida y precisa los programas educativos presentes.
      
      INSTRUCCIONES:
      1. Detecta si el documento es de un SOLO programa o un CATÁLOGO con varios.
      2. Para CADA programa detectado, extrae SOLO:
         - "title": Nombre del programa.
         - "target_audience": A quién va dirigido (breve).
         - "summary": Un resumen ejecutivo de 3-4 frases sobre de qué trata el programa.
         - "duration": Duración aproximada (si aparece).
      
      RESPUESTA: Devuelve un objeto JSON con esta estructura:
      {
        "is_multi_program": boolean,
        "programs": [
          { "title": "...", "target_audience": "...", "summary": "...", "duration": "..." },
          ...
        ]
      }

      IMPORTANTE: No te detengas en extraer módulos u objetivos detallados. Eso se hará en un paso posterior. 
      Responde ÚNICAMENTE con el JSON válido.
    `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64,
                    mimeType: 'application/pdf',
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        // 4. Parse JSON response
        await updateProgress(documentId, 'finalizing', 'Finalizando estructura...');

        let cleanJson = text.trim();
        if (cleanJson.includes('```')) {
            cleanJson = cleanJson.split(/```(?:json)?/)[1].split('```')[0].trim();
        }

        const resultDelta = JSON.parse(cleanJson);
        const programs = resultDelta.programs || [];
        const mainBriefing = programs.length === 1 ? programs[0] : null;

        // 5. Update database with results
        const { error: updateError } = await supabase
            .from('documents')
            .update({
                available_programs: programs,
                briefing: mainBriefing,
                status: 'processed',
                metadata: { stage: 'complete', message: 'Procesado correctamente' }
            })
            .eq('id', documentId);

        if (updateError) throw updateError;

        console.log(`✅ Successfully processed document ${documentId}`);

    } catch (err) {
        console.error(`❌ Error processing document ${documentId}:`, err);

        // Update document with error
        await supabase.from('documents').update({
            status: 'error',
            processing_error: err.message,
            metadata: { stage: 'error', message: err.message }
        }).eq('id', documentId);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Worker service running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
