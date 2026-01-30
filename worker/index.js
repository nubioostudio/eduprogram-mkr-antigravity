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

    processDocument(document_id, storage_path, req.body.target_language).catch(err => {
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

    extractProgramDetails(document_id, storage_path, program_title, null, req.body.target_language).catch(err => {
        console.error(`Error in deep extraction for ${document_id}:`, err);
    });
});

// Language mapping and cultural guidelines
const LANGUAGE_CONFIG = {
    es: { name: 'Español', rules: 'Tono profesional pero cercano.' },
    ca: { name: 'Catalán', rules: 'Tono cercano, familiar y de comunidad.' },
    gl: { name: 'Gallego', rules: 'Tono cercano, familiar y de confianza.' },
    en: { name: 'Inglés', rules: 'Tono directo, profesional y claro.' },
    fr: { name: 'Francés', rules: 'Tono elegante, formal y estructurado.' },
    de: { name: 'Alemán', rules: 'Tono formal, preciso, directo y orientado a la eficiencia y calidad.' },
    pt: { name: 'Portugués', rules: 'Tono profesional y amable.' },
    zh: { name: 'Chino', rules: 'Énfasis en PRESTIGIO, seguridad, certificaciones oficiales y valor a largo plazo. Tono muy formal.' },
    hi: { name: 'Hindi', rules: 'Énfasis en ROI (Retorno de Inversión), empleabilidad rápida y acreditaciones internacionales.' },
    ja: { name: 'Japonés', rules: 'Énfasis en respeto, ATENCIÓN AL DETALLE, procesos de seguridad y formalidad extrema.' },
    ko: { name: 'Coreano', rules: 'Énfasis en sofisticación, prestigio social, innovación y tendencias educativas.' }
};

function getLangConfig(code) {
    return LANGUAGE_CONFIG[code] || LANGUAGE_CONFIG['es'];
}

async function processDocument(documentId, storagePath, targetLanguage = null) {
    try {
        await updateProgress(documentId, 'starting', 'Iniciando análisis...');

        let langCode = targetLanguage;
        let context = '';

        if (!langCode) {
            console.log("No language provided in body, fetching from DB...");
            const { data: doc, error: fetchError } = await supabase
                .from('documents')
                .select('output_language, additional_context')
                .eq('id', documentId)
                .single();
            if (fetchError) throw fetchError;
            langCode = doc.output_language || 'es';
            context = doc.additional_context || '';
        } else {
            // Still fetch context if we have the ID
            const { data: doc } = await supabase.from('documents').select('additional_context').eq('id', documentId).single();
            context = doc?.additional_context || '';
        }

        const langCfg = getLangConfig(langCode);
        console.log(`Processing in: ${langCfg.name}`);

        const base64 = await downloadPDF(storagePath);

        await updateProgress(documentId, 'gemini_call', 'Identificando programas...');

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: `Eres un experto traductor y analista educativo. Tu REGLA DE ORO es: TODO el contenido que generes DEBE estar en ${langCfg.name}. 
            Incluso si el PDF está en inglés u otro idioma, tú DEBES TRADUCIRLO TODO al ${langCfg.name}. 
            NUNCA dejes texto en inglés en los campos JSON (objetivos, títulos, resúmenes, etc.). 
            Si el idioma es ${langCfg.name}, la respuesta DEBE ser 100% en ${langCfg.name}.`
        });

        const prompt = `
      Analiza el siguiente documento PDF (enviado como base64).
      
      OBJETIVO: Identificar los programas educativos presentes.
      
      IDIOMA DE SALIDA (REGLA ABSOLUTA): ${langCfg.name}.
      
      ADAPTACIÓN CULTURAL: ${langCfg.rules}
      
      CONTEXTO ADICIONAL DEL USUARIO: 
      "${context}"

      ---
      REGLAS DE IDIOMA INVIOLABLES (MÁXIMA PRIORIDAD):
      1. TODO EL CONTENIDO DEL JSON debe estar escrito en ${langCfg.name}.
      2. TRADUCE todos los títulos, resúmenes y audiencias al ${langCfg.name}. No dejes texto en inglés del original.
      3. Prohibido usar Inglés excepto para nombres propios de marcas.

      INSTRUCCIONES:
      1. Detecta si el documento es de un SOLO programa o un CATÁLOGO con varios.
      2. Para CADA programa detectado, extrae en ${langCfg.name}:
         - "title": Nombre del programa (Traducido).
         - "target_audience": A quién va dirigido (Traducido).
         - "summary": Resumen ejecutivo (Traducido).
         - "duration": Duración (Traducido).
      
      RESPUESTA: Devuelve EXCLUSIVAMENTE un objeto JSON:
      {
        "is_multi_program": boolean,
        "programs": [
          { "title": "...", "target_audience": "...", "summary": "...", "duration": "..." }
        ]
      }
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
            await extractProgramDetails(documentId, storagePath, programs[0].title, programs, langCode);
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

async function extractProgramDetails(documentId, storagePath, programTitle, availablePrograms = null, targetLanguage = null) {
    try {
        await updateProgress(documentId, 'deep_extraction', `Extrayendo detalles de: ${programTitle}...`);

        let langCode = targetLanguage;
        let context = '';

        if (!langCode) {
            const { data: doc, error: fetchError } = await supabase
                .from('documents')
                .select('output_language, additional_context')
                .eq('id', documentId)
                .single();
            if (fetchError) throw fetchError;
            langCode = doc.output_language || 'es';
            context = doc.additional_context || '';
        } else {
            const { data: doc } = await supabase.from('documents').select('additional_context').eq('id', documentId).single();
            context = doc?.additional_context || '';
        }

        const langCfg = getLangConfig(langCode);

        const base64 = await downloadPDF(storagePath);

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: `Eres un analista senior de marketing educativo. Tu tarea es extraer y TRADUCIR INTEGRALMENTE el contenido al ${langCfg.name}. 
            ESTA ES UNA ORDEN CRÍTICA: Aunque el PDF esté en inglés, tú DEBES escribir la respuesta 100% en ${langCfg.name}. 
            No dejes objetivos, módulos o metodología en inglés. Todo debe ser traducido de forma profesional al ${langCfg.name}.`
        });

        const prompt = `
      Analiza este PDF enfocado en: "${programTitle}".
      
      IDIOMA DE SALIDA (OBLIGATORIO): ${langCfg.name}. 
      TRADUCE TODO EL CONTENIDO. NO USES INGLÉS.
      
      ADAPTACIÓN: ${langCfg.rules}
      CONTEXTO USUARIO: "${context}"

      REGLAS CRÍTICAS:
      1. Traduce objetivos, módulos, metodología y audiencia al ${langCfg.name}.
      2. No dejes campos en inglés.

      EXTRAE ESTE JSON EN ${langCfg.name}:
      1. "title": Nombre (Traducido).
      2. "objectives": Objetivos (Lista traducida).
      3. "target_audience": Perfil alumno (Traducido).
      4. "duration": Carga horaria (Traducido).
      5. "key_highlights": Beneficios (Lista traducida).
      6. "modules": Módulos (Nombre y resumen traducidos).
      7. "methodology": Método (Traducido).
      8. "location": { "city", "country" }.
      9. "institution_summary": Resumen institución (Traducido).

      Responde SOLO el JSON.
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

