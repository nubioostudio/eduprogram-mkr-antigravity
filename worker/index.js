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

// Helper to download PDF from Supabase
async function downloadPDF(storagePath) {
    const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(storagePath);

    if (downloadError) throw downloadError;
    const arrayBuffer = await fileData.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
}

// Main processing endpoint (Stage 1: Detect Programs)
app.post('/process-document', async (req, res) => {
    const { document_id, storage_path } = req.body;
    console.log(`[${new Date().toISOString()}] 📥 Received POST /process-document for ${document_id}`);

    if (!document_id || !storage_path) {
        return res.status(400).json({ error: 'Missing document_id or storage_path' });
    }

    res.status(202).json({ message: 'Processing started', document_id });

    processDocument(document_id, storage_path).catch(err => {
        console.error(`Error processing ${document_id}:`, err);
    });
});

// Deep Extraction endpoint (Stage 2: Detailed extraction for a specific program)
app.post('/extract-details', async (req, res) => {
    const { document_id, storage_path, program_title } = req.body;
    console.log(`[${new Date().toISOString()}] 📥 Received POST /extract-details for ${document_id} (${program_title})`);

    if (!document_id || !storage_path || !program_title) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    res.status(202).json({ message: 'Deep extraction started', document_id, program_title });

    extractProgramDetails(document_id, storage_path, program_title).catch(err => {
        console.error(`Error in deep extraction for ${document_id}:`, err);
    });
});

async function processDocument(documentId, storagePath) {
    try {
        await updateProgress(documentId, 'starting', 'Iniciando análisis...');
        const base64 = await downloadPDF(storagePath);

        await updateProgress(documentId, 'gemini_call', 'Identificando programas...');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

      IMPORTANTE: Responde ÚNICAMENTE con el JSON válido. No incluyas texto extra.
    `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64, mimeType: 'application/pdf' } },
        ]);

        const response = await result.response;
        let cleanJson = response.text().trim();
        if (cleanJson.includes('```')) {
            cleanJson = cleanJson.split(/```(?:json)?/)[1].split('```')[0].trim();
        }

        const resultDelta = JSON.parse(cleanJson);
        const programs = resultDelta.programs || [];

        // Si solo hay uno, procedemos a extracción profunda automáticamente para ahorrar clicks
        if (programs.length === 1) {
            await extractProgramDetails(documentId, storagePath, programs[0].title, programs);
        } else {
            await supabase.from('documents').update({
                available_programs: programs,
                status: 'processed',
                metadata: { stage: 'complete', message: 'Programas detectados. Pendiente de selección.' }
            }).eq('id', documentId);
        }

    } catch (err) {
        await handleError(documentId, err);
    }
}

async function extractProgramDetails(documentId, storagePath, programTitle, availablePrograms = null) {
    try {
        await updateProgress(documentId, 'deep_extraction', `Extrayendo detalles de: ${programTitle}...`);
        const base64 = await downloadPDF(storagePath);

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `
      Analiza este PDF educativo enfocado EXCLUSIVAMENTE en el programa intitulado: "${programTitle}".
      
      EXTRAE LA SIGUIENTE INFORMACIÓN EN FORMATO JSON:
      1. "title": Nombre oficial del programa.
      2. "objectives": Lista de los objetivos principales de aprendizaje.
      3. "target_audience": Descripción detallada del perfil del alumno ideal.
      4. "duration": Duración y carga horaria.
      5. "key_highlights": 4-5 puntos fuertes o beneficios únicos del programa.
      6. "modules": Lista de módulos o unidades temáticas. Cada módulo debe tener:
         - "name": Nombre del módulo.
         - "summary": Breve descripción de lo que se enseña.
      7. "methodology": Breve descripción de la metodología (presencial, online, casos prácticos, etc).

      IMPORTANTE: No te inventes nada. Si no aparece algo, pon un texto coherente basado en el contexto.
      Responde SOLO con el JSON.
    `;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64, mimeType: 'application/pdf' } },
        ]);

        const response = await result.response;
        let cleanJson = response.text().trim();
        if (cleanJson.includes('```')) {
            cleanJson = cleanJson.split(/```(?:json)?/)[1].split('```')[0].trim();
        }

        const deepData = JSON.parse(cleanJson);

        // Update DB
        const updatePayload = {
            briefing: deepData,
            status: 'processed',
            metadata: { stage: 'complete', message: 'Análisis profundo completado' }
        };

        if (availablePrograms) {
            updatePayload.available_programs = availablePrograms;
        }

        await supabase.from('documents').update(updatePayload).eq('id', documentId);
        console.log(`✅ Deep extraction complete for ${documentId} - ${programTitle}`);

    } catch (err) {
        await handleError(documentId, err);
    }
}

async function updateProgress(documentId, stage, message) {
    console.log(`[${stage}] ${message}`);
    await supabase.from('documents').update({
        metadata: {
            stage,
            message,
            updated_at: new Date().toISOString()
        }
    }).eq('id', documentId);
}

async function handleError(documentId, err) {
    console.error(`❌ Error in worker:`, err);
    await supabase.from('documents').update({
        status: 'error',
        processing_error: err.message,
        metadata: { stage: 'error', message: err.message }
    }).eq('id', documentId);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Worker service running on port ${PORT}`);
});

