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
          { 
            "title": "Nombre traducido al ${langCfg.name}", 
            "original_title": "Nombre tal cual aparece en el PDF original",
            "target_audience": "...", 
            "summary": "...", 
            "duration": "..." 
          }
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
        let agencyId = null;

        const { data: doc, error: fetchError } = await supabase
            .from('documents')
            .select('agency_id, output_language, additional_context')
            .eq('id', documentId)
            .single();

        if (fetchError) throw fetchError;
        agencyId = doc.agency_id;
        langCode = langCode || doc.output_language || 'es';
        context = doc.additional_context || '';

        const langCfg = getLangConfig(langCode);
        await updateProgress(documentId, 'deep_extraction', `Extrayendo Inteligencia de Marketing (${langCfg.name.toUpperCase()}): ${programTitle}...`);

        const base64 = await downloadPDF(storagePath);

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: `Eres un estratega de marketing educativo de élite. 
            Tu misión es extraer "Inteligencia Comercial" de programas educativos.
            REGLA DE ORO DE IDIOMA: TODO debe estar en ${langCfg.name.toUpperCase()}.
            REGLA DE MARKETING: No resumas temarios, extrae TRANSFORMACIONES y BENEFICIOS.`
        });

        const prompt = `
      EXTRACTOR DE ACTIVOS COMERCIALES (MARKETING EDUCATIONAL ENGINE)
      
      Programa: "${programTitle}"
      Idioma de Salida: ${langCfg.name.toUpperCase()}
      Reglas Culturales: ${langCfg.rules}
      Contexto Adicional: "${context}"

      TAREA: Analiza el PDF y extrae la siguiente información técnica y emocional. 
      Si no encuentras un dato específico, GENÉRALO basado en el contexto para que sea comercialmente atractivo.

      ESTRUCTURA JSON REQUERIDA (TODO EN ${langCfg.name.toUpperCase()}):
      {
        "core_data": {
          "title": "Nombre comercial",
          "original_title": "Nombre original en PDF",
          "institution": "Nombre de la institución",
          "duration": "Carga horaria/Duración",
          "location": "Ciudad/País/Online",
          "price_context": "Cualquier mención a becas, precios o formas de pago"
        },
        "marketing_assets": {
          "headline": "Titular de alto impacto (Gancho emocional + Beneficio)",
          "hook": "El problema principal que resuelve (Identificar el dolor del estudiante)",
          "target_profile": "Perfil detallado del alumno ideal",
          "anti_profile": "Para quién NO es este programa (Filtro de calidad)",
          "transformation": "La gran promesa de cambio tras terminar el programa",
          "key_benefits": ["Lista de 5 beneficios tangibles, no solo características"],
          "differentiation": "¿Por qué este programa y no el de la competencia?",
          "methodology": "Cómo se enseña (Práctico, basado en proyectos, etc.)",
          "access_requirements": "Qué necesita el alumno para entrar",
          "learning_milestones": ["Los 4-6 puntos clave del temario redactados como 'Hitos de Éxito'"],
          "social_proof_areas": "Áreas donde el programa presume de prestigio (profesores, empresas, rankings)"
        },
        "social_raw": {
          "linkedin_hook": "Una frase para empezar un post de LinkedIn",
          "instagram_concept": "Idea visual para un carrusel descriptivo"
        }
      }

      Responde ÚNICAMENTE el JSON.
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

        // 1. Save individual assets to commercial_assets table for the Hub
        const assetsToInsert = [
            { type: 'headline', content: deepData.marketing_assets.headline },
            { type: 'hook', content: deepData.marketing_assets.hook },
            { type: 'target_profile', content: deepData.marketing_assets.target_profile },
            { type: 'transformation', content: deepData.marketing_assets.transformation },
            { type: 'differentiation', content: deepData.marketing_assets.differentiation },
            { type: 'linkedin_hook', content: deepData.social_raw.linkedin_hook },
            { type: 'instagram_concept', content: deepData.social_raw.instagram_concept },
        ].map(asset => ({
            ...asset,
            agency_id: agencyId,
            document_id: documentId,
            metadata: { program_title: programTitle }
        }));

        const { error: assetError } = await supabase.from('commercial_assets').insert(assetsToInsert);
        if (assetError) console.error('Error saving commercial assets:', assetError);

        // 2. Update Document with full briefing (for proposal generation compat)
        // Map new structure to old briefing structure for backward compatibility if needed
        const legacyBriefing = {
            title: deepData.core_data.title,
            original_title: deepData.core_data.original_title,
            objectives: deepData.marketing_assets.learning_milestones,
            target_audience: deepData.marketing_assets.target_profile,
            duration: deepData.core_data.duration,
            key_highlights: deepData.marketing_assets.key_benefits,
            modules: deepData.marketing_assets.learning_milestones.map(m => ({ name: m, summary: '' })),
            methodology: deepData.marketing_assets.methodology,
            location: { city: deepData.core_data.location, country: '' },
            institution_summary: deepData.core_data.institution
        };

        const updatePayload = {
            briefing: legacyBriefing,
            status: 'processed',
            metadata: {
                stage: 'complete',
                message: 'Análisis profundo y Hub de Marketing completado',
                marketing_engine_v1: true
            }
        };

        if (availablePrograms) {
            updatePayload.available_programs = availablePrograms;
        }

        await supabase.from('documents').update(updatePayload).eq('id', documentId);
        console.log(`✅ Marketing Engine Extraction complete for ${documentId} - ${programTitle}`);

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

