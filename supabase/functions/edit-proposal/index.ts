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

    try {
        const { proposal_id, instruction, images, target_element } = await req.json();
        console.log("=== EDIT-PROPOSAL START ===", { proposal_id, instruction, target_element });

        if (!proposal_id || !instruction) {
            throw new Error("Missing proposal_id or instruction");
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const geminiKey = Deno.env.get('GEMINI_API_KEY');

        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
            throw new Error("Supabase config missing");
        }
        if (!geminiKey) throw new Error("GEMINI_API_KEY missing");

        // Create user-scoped client to verify token
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error("No authorization header");

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) throw new Error("Unauthorized");

        // Service role client for database operations
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get current proposal
        console.log("Fetching proposal...");
        const { data: proposal, error: fetchError } = await supabase
            .from('proposals')
            .select('*, documents(briefing)')
            .eq('id', proposal_id)
            .single();

        if (fetchError) {
            console.error('Fetch error:', fetchError);
            throw new Error("Proposal not found: " + fetchError.message);
        }

        console.log("Proposal found, status:", proposal.status);

        // 2. Prepare content
        const content = proposal.content || {};
        const currentSections = content.sections || [];

        console.log("Current sections count:", currentSections.length);

        // 3. Call Gemini
        console.log("Calling Gemini...");
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `Eres un Director Creativo Senior especializado en propuestas educativas.
Aplicas la filosofía de diseño ANTIGRAVITY LAYOUT DESIGN.

## FILOSOFÍA DE DISEÑO
- El espacio comunica jerarquía
- La dominancia visual se establece con intención
- La tipografía es estructural, no decorativa
- Máximo 2 niveles de énfasis por viewport
- El espacio negativo es un elemento de primer orden
- Cada decisión de espaciado, alineación y proporción debe sentirse intencional

## MODO: EDITORIAL (obligatorio para propuestas)
- Una estructura visual dominante por viewport
- Jerarquía espacial fuerte
- Menos secciones, más impacto
- El layout debe sentirse "terminado" e intencional

## SISTEMA DE BLOORES (Propiedades de Estilo)
1. hero: {
    headline, intro, 
    logo_position: "left"|"center"|"right", 
    text_align: "left"|"center"|"right", 
    overlay_opacity: 0-100,
    headline_size: "0-200%" (ej: "60%" para reducir un 40%),
    intro_size: "0-200%"
}
2. solution: {
    title, text, 
    text_align: "left"|"center"|"right",
    title_size: "0-200%",
    text_size: "0-200%"
}
3. features: {
    title, items: [], 
    text_align: "left"|"center"|"right",
    title_size: "0-200%"
}
4. columns: {layout: "4-8"|"8-4"|"6-6", left_content: {type, value}, right_content: {type, value}}
5. image_full: {image_url, caption}
6. cta: {headline, button_text}
7. footer: {text, show_social: boolean}

## CONTEXTO DE EDICIÓN
${target_element ? `EL USUARIO HA SELECCIONADO UN ELEMENTO ESPECÍFICO:
- Bloque ID: ${target_element.block_id}
- Campo (path): ${target_element.path}
Solo debes modificar este elemento si es posible, o el bloque al que pertenece, para cumplir con la instrucción.` : 'El usuario está pidiendo cambios generales en la propuesta.'}

## SECCIONES ACTUALES
${JSON.stringify(currentSections, null, 2)}

## INSTRUCCIÓN DEL USUARIO
"${instruction}"

## TU TAREA
Aplica los cambios manteniendo la filosofía de diseño editorial.
1. MANTÉN los IDs existentes de los bloques.
2. Si añades un bloque nuevo, àsínale un ID descriptivo único.
3. Si hay un elemento seleccionado (${target_element?.path || 'ninguno'}), prioriza el cambio en ESE elemento.
4. El resultado debe sentirse DISEÑADO, no generado.

Devuelve SOLO el JSON sin explicaciones:
{"sections": [...]}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log("Gemini response length:", responseText.length);
        console.log("Gemini response preview:", responseText.substring(0, 300));

        // 4. Parse response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("No JSON found in response");
            throw new Error("AI response invalid - no JSON");
        }

        let newContent;
        try {
            newContent = JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error("JSON parse failed:", e);
            throw new Error("AI response invalid - parse failed");
        }

        if (!newContent.sections) {
            console.error("No sections in parsed content");
            throw new Error("AI response invalid - no sections");
        }

        console.log("Parsed sections count:", newContent.sections.length);

        // 5. Update proposal
        const updatedContent = {
            ...content,
            sections: newContent.sections,
        };

        const { error: updateError } = await supabase
            .from('proposals')
            .update({ content: updatedContent })
            .eq('id', proposal_id);

        if (updateError) {
            console.error('Update error:', updateError);
            throw new Error("Update failed: " + updateError.message);
        }

        console.log("=== EDIT-PROPOSAL SUCCESS ===");
        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("=== EDIT-PROPOSAL ERROR ===", error.message || error);
        return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
