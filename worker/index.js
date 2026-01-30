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
    const { document_id, storage_path, target_language } = req.body;
    console.log(`[${new Date().toISOString()}] 📥 POST /process-document | ID: ${document_id} | Lang: ${target_language}`);

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
    const { document_id, storage_path, program_title, target_language } = req.body;
    console.log(`[${new Date().toISOString()}] 📥 POST /extract-details | ID: ${document_id} | Title: ${program_title} | Lang: ${target_language}`);

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
      INSTRUCCIÓN DE IDIOMA CRÍTICA (REGLA DE ORO):
      TODO EL CONTENIDO DEBE ESTAR EN ${langCfg.name.toUpperCase()}.
      SI EL PDF ESTÁ EN INGLÉS, TU TRABAJO ES TRADUCIRLO INTEGRAMENTE AL ${langCfg.name.toUpperCase()}.
      No dejes ni una sola palabra en inglés en los campos de texto (excepto nombres de marcas o instituciones).

      Analiza el siguiente documento PDF (enviado como base64).
      
      OBJETIVO: Identificar los programas educativos presentes.
      
      IDIOMA DE SALIDA SELECCIONADO: ${langCfg.name}.
      ADAPTACIÓN CULTURAL: ${langCfg.rules}
      CONTEXTO ADICIONAL DEL USUARIO: "${context}"

      INSTRUCCIONES:
      1. Detecta si el documento es de un SOLO programa o un CATÁLOGO con varios.
      2. Para CADA programa detectado, extrae en ${langCfg.name} (TRADUCIENDO SIEMPRE):
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
        await updateProgress(documentId, 'deep_extraction', `Extrayendo en ${langCfg.name.toUpperCase()}: ${programTitle}...`);

        const base64 = await downloadPDF(storagePath);

        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-pro',
            systemInstruction: `Eres un analista senior de marketing educativo. TU MISIÓN PRINCIPAL es TRADUCIR TODO al ${langCfg.name.toUpperCase()}. 
            CUALQUIER texto en inglés extraído del PDF debe ser traducido de forma elegante y profesional al ${langCfg.name.toUpperCase()}.
            NO está permitido dejar nada en inglés. Si fallas en traducir, la tarea es un fracaso total.`
        });

        const prompt = `
      ORDEN CRÍTICA DE TRADUCCIÓN:
      TIENES PROHIBIDO ESCRIBIR EN INGLÉS.
      IDIOMA DE SALIDA (OBLIGATORIO): ${langCfg.name.toUpperCase()}.
      SI EL PDF ESTÁ EN INGLÉS, TRADÚCELO TODO AL ${langCfg.name.toUpperCase()}.
      
      Analiza este PDF enfocado en el programa: "${programTitle}".
      
      REGLAS DE NEGOCIO:
      - ADAPTACIÓN CULTURAL: ${langCfg.rules}
      - CONTEXTO USUARIO: "${context}"

      EXTRAE ESTE JSON EN ${langCfg.name.toUpperCase()} (TRADUCE TODO):
      1. "title": Nombre del programa (Traducido).
      2. "objectives": Objetivos del programa (Lista traducida).
      3. "target_audience": Perfil del alumno ideal (Traducido).
      4. "duration": Carga horaria / Duración (Traducido).
      5. "key_highlights": Puntos clave y beneficios (Lista traducida).
      6. "modules": Módulos o materias (Nombre y resumen de cada uno - TODO TRADUCIDO).
      7. "methodology": Metodología de enseñanza (Traducido).
      8. "location": { "city", "country" }.
      9. "institution_summary": Resumen de la institución educativa (Traducido).

      Responde SOLO el JSON purificado.
    `;

        console.log(`[DEBUG] Final Prompt for Deep Extraction:\n${prompt.substring(0, 500)}...`);

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

