import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let currentProposalId: string | null = null;

    try {
        const body = await req.json();
        const { proposal_id, include_institution, include_location, cta_config, language = 'es' } = body;
        currentProposalId = proposal_id;

        console.log("--- INICIANDO GENERACIÓN (v2.0 Flash) --- ID:", proposal_id);

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const geminiKey = Deno.env.get("GEMINI_API_KEY");

        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
            throw new Error("Configuración de Supabase incompleta");
        }
        if (!geminiKey) throw new Error("GEMINI_API_KEY no configurada");

        // Create user-scoped client to verify token
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error("No authorization header");

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) throw new Error("Acceso no autorizado");

        // Service role client for database operations
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Obtener datos
        const { data: proposal, error: propError } = await supabase
            .from('proposals')
            .select('*, documents(briefing)')
            .eq('id', proposal_id)
            .single();

        if (propError) throw new Error(`Error en BD: ${propError.message}`);
        if (!proposal) throw new Error("La propuesta no existe");

        const briefing = proposal.documents?.briefing;
        if (!briefing) throw new Error("No se encontró el briefing del documento");

        const tone = proposal.tone || "Profesional";

        // 2. IA Gemini - Usando Gemini 2.0 Flash
        console.log("Conectando con Gemini 2.0 Flash...");
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
            Eres un Director Creativo Senior y experto en Marketing Educativo de Élite.
            Tu misión es transformar el siguiente BRIEFING en una PROPUESTA COMERCIAL IRRESISTIBLE aplicando la filosofía ANTIGRAVITY LAYOUT DESIGN.

            ## FILOSOFÍA DE DISEÑO (Antigravity Layout)
            - Modo de expresión: EDITORIAL (obligatorio).
            - Espacio comunica jerarquía y dominancia visual intencional.
            - Tipografía estructural: Máximo 2 niveles de énfasis por viewport.
            - El espacio negativo es un elemento de primer orden.
            - Todo debe sentirse DISEÑADO y ejecutado a nivel maestro, con moderación y propósito.

            - Liderazgo y Transformación: Enfócate en el cambio del estudiante.
            - Método AIDA: Capta la atención, genera deseo y guía a la acción.
            - Tono: ${tone} (Usa un vocabulario rico, dinámico y persuasivo).
            - IDIOMA DE SALIDA: ${language === 'en' ? 'English' : language === 'fr' ? 'French' : language === 'pt' ? 'Portuguese' : language === 'it' ? 'Italian' : language === 'de' ? 'German' : 'Spanish'}. (DEBES escribir TODA la propuesta en este idioma).

            ## SISTEMA DE BLOQUES DISPONIBLES (Propiedades de Estilo)
            1. 'hero': { 
                "headline", "intro", "image_prompt", 
                "logo_position": "left"|"center"|"right", 
                "text_align": "left"|"center"|"right", 
                "overlay_opacity": 0-100,
                "headline_size": "0-200%" (ej: "120%" para más grande),
                "intro_size": "0-200%"
            }
            2. 'solution': { 
                "title", "text",
                "text_align": "left"|"center"|"right",
                "title_size": "0-200%",
                "text_size": "0-200%"
            }
            3. 'features': { 
                "title", "items",
                "text_align": "left"|"center"|"right",
                "title_size": "0-200%"
            }
            4. 'columns': { "layout": "4-8"|"8-4"|"6-6", "left_content": { "type": "text"|"image", "value" }, "right_content": { "type": "text"|"image", "value" } }
            5. 'image_full': { "image_url" or "image_prompt", "caption" }
            6. 'cta': { "headline", "button_text", "button_link", "type", "is_popup" }
            7. 'footer': { "text", "show_social": boolean }

            ## DATOS DEL BRIEFING:
            ${JSON.stringify(briefing)}

            ## CONFIGURACIÓN ESPECÍFICA:
            - Incluir Institución: ${include_institution ? 'SÍ' : 'NO'}
            - Incluir Localización: ${include_location ? 'SÍ' : 'NO'}
            - CTA: ${cta_config?.type || 'Default'} (${cta_config?.value || 'N/A'})

            ## TU TAREA:
            Genera la propuesta completa usando el sistema de bloques. 
            Asegúrate de que la primera sección (hero) sea impactante.
            Usa el bloque 'columns' para estructurar información compleja si es necesario.
            Mantén la coherencia visual y estratégica.

            RESPONDE ÚNICAMENTE CON UN JSON VÁLIDO:
            {
                "sections": [
                    { 
                        "id": "nombre_descriptivo_unico",
                        "type": "...", 
                        "settings": { ... } 
                    }
                ],
                "visual_suggestions": "Breve nota sobre la dirección artística sugerida"
            }
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        let cleanJson = text.trim();
        if (cleanJson.includes("```")) {
            cleanJson = cleanJson.split(/```(?:json)?/)[1].split("```")[0].trim();
        }

        const proposalContent = JSON.parse(cleanJson);

        // 3. Guardar en BD
        const { error: updateError } = await supabase
            .from('proposals')
            .update({
                content: proposalContent,
                status: 'ready'
            })
            .eq('id', proposal_id);

        if (updateError) throw new Error(`Error al guardar: ${updateError.message}`);

        console.log("--- ÉXITO: Propuesta lista con Gemini 2.0 ---");
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("ERROR GENERACIÓN:", err.message);

        if (currentProposalId) {
            const supabaseUrl = Deno.env.get("SUPABASE_URL");
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
            if (supabaseUrl && supabaseKey) {
                const supabase = createClient(supabaseUrl, supabaseKey);
                await supabase.from('proposals').update({
                    status: 'error',
                    content: { error: `Gemini 2.0 Error: ${err.message}` }
                }).eq('id', currentProposalId);
            }
        }

        return new Response(JSON.stringify({ error: err.message }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
