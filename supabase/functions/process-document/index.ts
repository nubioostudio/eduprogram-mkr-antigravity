import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.14.0";
import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

Deno.serve(async (req: Request) => {
    let documentId: string | undefined;
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    try {
        // 1. Parse Request
        const body = await req.json();
        const { record } = body;
        documentId = record?.id;
        const agencyId = record?.agency_id;
        const storagePath = record?.storage_path;

        if (!documentId) throw new Error("Missing document ID");

        console.log(`[${new Date().toISOString()}] Processing document ${documentId}`);

        // Helper to update progress metadata
        const updateProgress = async (stage: string, message: string) => {
            console.log(`[${new Date().toISOString()}] Progress: ${stage} - ${message}`);
            await supabase.from("documents").update({
                status: "processing",
                metadata: { stage, message, updated_at: new Date().toISOString() }
            }).eq("id", documentId);
        };

        // Update status to processing
        await updateProgress("starting", "Iniciando análisis...");

        // 3. Download PDF from Storage
        await updateProgress("downloading", "Descargando PDF desde storage...");
        const { data: fileData, error: downloadError } = await supabase.storage
            .from("documents")
            .download(storagePath);

        if (downloadError) throw downloadError;

        // 4. Extract Content & Convert to Base64
        await updateProgress("extracting", "Preparando documento para análisis...");
        const arrayBuffer = await fileData.arrayBuffer();
        const base64 = encodeBase64(arrayBuffer);

        // 5. Call Gemini 2.0 Flash
        await updateProgress("gemini_call", "Analizando con Gemini 2.0 Flash...");
        const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
        if (!apiKey) {
            console.error("Critical: GEMINI_API_KEY is missing in Edge Function environment.");
            throw new Error("Server Misconfiguration: Missing API Key");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

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

        // Implementation of timeout for Gemini
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout: Gemini tardó demasiado en responder")), 50000)
        );

        const geminiPromise = model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64,
                    mimeType: "application/pdf",
                },
            },
        ]);

        const result: any = await Promise.race([geminiPromise, timeout]);
        const response = await result.response;
        const text = response.text();

        // 6. Finalize
        await updateProgress("finalizing", "Finalizando estructura...");

        // Clean JSON response
        let cleanJson = text.trim();
        if (cleanJson.includes("```")) {
            cleanJson = cleanJson.split(/```(?:json)?/)[1].split("```")[0].trim();
        }

        const resultDelta = JSON.parse(cleanJson);
        const programs = resultDelta.programs || [];
        const mainBriefing = programs.length === 1 ? programs[0] : null;

        // Update Database
        const { error: updateError } = await supabase
            .from("documents")
            .update({
                available_programs: programs,
                briefing: mainBriefing,
                status: "processed",
                metadata: { stage: "complete", message: "Procesado correctamente" }
            })
            .eq("id", documentId);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, briefing: mainBriefing, programs }), {
            headers: { "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("Processing Error:", err);

        if (documentId) {
            try {
                await supabase.from("documents")
                    .update({
                        status: "error",
                        processing_error: err.message,
                        metadata: { stage: "error", message: err.message }
                    })
                    .eq("id", documentId);
            } catch (innerErr) {
                console.error("Secondary error updating DB:", innerErr);
            }
        }

        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
