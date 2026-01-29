import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export function DocumentViewerPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [document, setDocument] = useState<any>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDocument() {
            if (!id) return;
            try {
                const { data, error } = await supabase
                    .from('documents')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                setDocument(data);

                // Get Signed URL (Bucket is private)
                const { data: signedData, error: signedError } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(data.storage_path, 3600); // 1 hour

                if (signedError) throw signedError;
                setPdfUrl(signedData.signedUrl);
            } catch (error) {
                console.error('Error fetching document:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchDocument();
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-neutral-900 text-white gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium animate-pulse">Cargando documento original...</p>
            </div>
        );
    }

    if (!document || !pdfUrl) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-neutral-900 text-white gap-6">
                <p>No se pudo encontrar el documento.</p>
                <Button onClick={() => navigate(-1)}>Volver</Button>
            </div>
        );
    }

    return (
        <div className="h-screen bg-neutral-900 flex flex-col overflow-hidden">
            {/* Header Control */}
            <header className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-black/40 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(-1)}
                        className="text-neutral-400 hover:text-white"
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Volver al Briefing
                    </Button>
                    <div className="h-4 w-[1px] bg-white/10" />
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-white max-w-[200px] truncate">
                            {document.filename}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(pdfUrl, '_blank')}
                        className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                    >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir en nueva pestaña
                    </Button>
                </div>
            </header>

            {/* PDF Viewer */}
            <main className="flex-1 w-full bg-[#525659] relative">
                <iframe
                    src={`${pdfUrl}#toolbar=1&navpanes=0`}
                    className="w-full h-full border-0"
                    title={document.filename}
                />
            </main>
        </div>
    );
}
