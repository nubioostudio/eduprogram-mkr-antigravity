import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
    // 1. Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    let documentId: string | undefined;

    try {
        console.log(`[${new Date().toISOString()}] Incoming request: ${req.method}`);

        // 2. Initialize Supabase Client
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const workerUrl = Deno.env.get("WORKER_SERVICE_URL");

        if (!supabaseUrl || !supabaseKey || !workerUrl) {
            console.error("Missing environment variables");
            throw new Error("Server configuration error: Missing environment variables");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 3. Parse Request
        const body = await req.json();
        console.log("Request Body:", JSON.stringify(body));

        const { record, program_title } = body;
        documentId = record?.id || body.id;
        const storagePath = record?.storage_path || body.storage_path;

        if (!documentId) throw new Error("Missing document ID");

        const endpoint = program_title ? "extract-details" : "process-document";
        console.log(`Triggering ${endpoint} for document ${documentId}`);

        // 4. Update status to processing
        const { error: updateError } = await supabase.from("documents").update({
            status: "processing",
            metadata: {
                stage: program_title ? "deep_extraction" : "webhook_trigger",
                message: program_title ? `Extrayendo detalles de ${program_title}...` : "Iniciando procesamiento...",
                updated_at: new Date().toISOString()
            }
        }).eq("id", documentId);

        if (updateError) {
            console.error("Error updating document status:", updateError);
            throw new Error(`Database error: ${updateError.message}`);
        }

        // 5. Trigger the external worker service
        console.log(`Calling worker at ${workerUrl}/${endpoint}`);
        const workerResponse = await fetch(`${workerUrl}/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                document_id: documentId,
                storage_path: storagePath,
                program_title: program_title
            }),
        });

        if (!workerResponse.ok) {
            const errorText = await workerResponse.text();
            console.error("Worker service error:", errorText);
            throw new Error(`Worker service failed (HTTP ${workerResponse.status}): ${errorText}`);
        }

        const workerResult = await workerResponse.json();
        console.log("Worker success:", workerResult);

        return new Response(JSON.stringify({
            success: true,
            message: "Processing started in worker",
            document_id: documentId,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
        });

    } catch (err: any) {
        console.error("Fatal Edge Function Error:", err.message);

        // Intentamos actualizar el estado del documento a error si tenemos el ID
        if (documentId) {
            try {
                const supabaseUrl = Deno.env.get("SUPABASE_URL");
                const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
                if (supabaseUrl && supabaseKey) {
                    const supabase = createClient(supabaseUrl, supabaseKey);
                    await supabase.from("documents")
                        .update({
                            status: "error",
                            processing_error: err.message,
                            metadata: { stage: "error", message: err.message, fatal: true }
                        })
                        .eq("id", documentId);
                }
            } catch (innerErr) {
                console.error("Could not update error status in DB:", innerErr);
            }
        }

        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
