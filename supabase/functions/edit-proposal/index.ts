import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.1.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { proposal_id, instruction } = await req.json();

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const geminiKey = Deno.env.get('GEMINI_API_KEY')!;

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Get current proposal data
        const { data: proposal, error: fetchError } = await supabase
            .from('proposals')
            .select('*, documents(briefing)')
            .eq('id', proposal_id)
            .single();

        if (fetchError || !proposal) {
            throw new Error("Proposal not found");
        }

        // 2. Prepare Gemini
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
        Eres un experto en Marketing Educativo de Élite.
        Estás editando una propuesta comercial para un programa de formación.
        
        BRIEFING ORIGINAL DEL PROGRAMA:
        ${JSON.stringify(proposal.documents.briefing)}
        
        CONTENIDO ACTUAL DE LA PROPUESTA:
        ${JSON.stringify(proposal.content)}
        
        INSTRUCCIÓN DEL USUARIO PARA LA EDICIÓN:
        "${instruction}"
        
        Tu tarea es REGENERAR el contenido de la propuesta (headline, intro, solution_presentation, key_benefits, call_to_action, visual_suggestions, image_prompt) basándote en la instrucción de edición, manteniendo la coherencia con el briefing original pero aplicando los cambios solicitados.
        
        REGLAS:
        1. Mantén el formato JSON.
        2. El tono debe ser profesional y persuasivo.
        3. Si pide un cambio de tono, aplícalo agresivamente en todo el texto.
        4. No inventes datos que contradigan el briefing.
        
        RESPONDE ÚNICAMENTE CON EL JSON:
        {
          "headline": "...",
          "intro": "...",
          "solution_presentation": "...",
          "key_benefits": ["...", "..."],
          "call_to_action": "...",
          "visual_suggestions": "...",
          "image_prompt": "..."
        }
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error("Invalid AI response");
        }

        const newContent = JSON.parse(jsonMatch[0]);

        // 3. Update proposal
        const { error: updateError } = await supabase
            .from('proposals')
            .update({ content: newContent })
            .eq('id', proposal_id);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
