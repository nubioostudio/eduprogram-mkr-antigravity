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
        const { proposal_id } = body;
        currentProposalId = proposal_id;

        console.log("--- INICIANDO GENERACIÓN (v2.0 Flash) --- ID:", proposal_id);

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const geminiKey = Deno.env.get("GEMINI_API_KEY");

        if (!supabaseUrl || !supabaseKey) throw new Error("Configuración de Supabase incompleta");
        if (!geminiKey) throw new Error("GEMINI_API_KEY no configurada");

        const supabase = createClient(supabaseUrl, supabaseKey);

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
            Eres un experto en Marketing Educativo de Élite. Tu misión es transformar el siguiente BRIEFING en una PROPUESTA COMERCIAL IRRESISTIBLE.
            
            MARCO DE TRABAJO (Skill Marketing Educativo):
            - Liderazgo y Transformación: Enfócate en el cambio que el estudiante experimentará.
            - Método AIDA: Capta la atención de inmediato y guía al deseo.
            - Tono: ${tone} (Usa un vocabulario rico, dinámico y persuasivo).
            
            BRIEFING DEL PROGRAMA:
            ${JSON.stringify(briefing)}
            
            REGLAS DE RESPUESTA:
            1. Devuelve ÚNICAMENTE un objeto JSON.
            2. 'headline': Un titular de impacto, no genérico (ej: "Domina el Arte de..." en lugar de "Curso de...").
            3. 'intro': Conecta con la aspiración profunda del cliente.
            4. 'solution_presentation': Presenta el programa como el puente hacia su éxito.
            5. 'key_benefits': 4 beneficios potentes centrados en RESULTADOS.
            6. 'call_to_action': Un cierre emocional y directo.
            7. 'image_prompt': Un prompt descriptivo en INGLÉS para Unsplash (ej: "cinematic photo of visionary leader in modern city office, sunrise light, 8k").
            
            ESTRUCTURA JSON:
            {
                "headline": "...",
                "intro": "...",
                "solution_presentation": "...",
                "key_benefits": ["...", "...", "...", "..."],
                "call_to_action": "...",
                "visual_suggestions": "...",
                "image_prompt": "..."
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
