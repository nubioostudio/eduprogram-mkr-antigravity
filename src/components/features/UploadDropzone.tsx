import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export function UploadDropzone({ variant = 'default' }: { variant?: 'default' | 'minimal' }) {
    const [files, setFiles] = useState<File[]>([]);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
    const [documentId, setDocumentId] = useState<string | null>(null);
    const [briefing, setBriefing] = useState<any | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const { profile } = useAuth();
    const navigate = useNavigate();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFiles([acceptedFiles[0]]);
            setStatus('idle');
            setDocumentId(null);
            setBriefing(null);
            setUploadError(null);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
        },
        maxFiles: 1,
    });

    // Subscribe to real-time changes if we have a documentId
    useEffect(() => {
        if (!documentId) return;

        console.log('UploadDropzone: Subscribing to real-time updates for', documentId);
        const channel = supabase
            .channel(`doc-${documentId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'documents',
                    filter: `id=eq.${documentId}`,
                },
                (payload) => {
                    console.log('UploadDropzone: Real-time update received', payload.new.status, payload.new.metadata);
                    const newStatus = payload.new.status;
                    const metadata = payload.new.metadata;

                    if (newStatus === 'processed') {
                        setStatus('success');
                        setBriefing(payload.new.briefing);
                    } else if (newStatus === 'processing') {
                        setStatus('processing');
                        if (metadata?.message) {
                            setUploadError(null); // Clear any previous transient error
                            setProcessingMessage(metadata.message);
                        }
                    } else if (newStatus === 'error') {
                        setStatus('error');
                        setUploadError(payload.new.processing_error || 'AI Processing failed');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [documentId]);

    const [processingMessage, setProcessingMessage] = useState<string>('Analizando...');

    const handleUpload = async () => {
        if (files.length === 0 || !profile?.agency_id) return;

        setStatus('uploading');
        setUploadError(null);
        try {
            const file = files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data, error: dbError } = await supabase
                .from('documents')
                .insert({
                    agency_id: profile.agency_id,
                    filename: file.name,
                    storage_path: filePath,
                    status: 'pending'
                })
                .select()
                .single();

            if (dbError) throw dbError;

            setDocumentId(data.id);
            setStatus('processing'); // Set early to optimize UI flow
            // Webhook takes it from here
        } catch (e: any) {
            console.error('UploadDropzone Error:', e);
            setStatus('error');
            setUploadError(e.message || 'Upload failed');
        }
    };

    const removeFile = () => {
        setFiles([]);
        setStatus('idle');
        setDocumentId(null);
        setBriefing(null);
        setUploadError(null);
    };

    if (variant === 'minimal') {
        return (
            <div className="w-full h-full min-h-[180px] flex flex-col justify-center gap-4">
                {files.length === 0 ? (
                    <div
                        {...getRootProps()}
                        className={cn(
                            "border-2 border-dashed rounded-[3rem] p-10 text-center cursor-pointer transition-all duration-500 flex-1 flex flex-col items-center justify-center min-h-[180px] relative overflow-hidden group",
                            isDragActive
                                ? "border-primary bg-primary/20 scale-[0.98]"
                                : "border-white/40 bg-white/10 hover:border-primary/60 hover:bg-white/15 shadow-2xl shadow-black/20"
                        )}
                    >
                        <input {...getInputProps()} />
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                        <div className="p-6 bg-primary text-white rounded-[1.5rem] mb-6 shadow-2xl shadow-primary/40 group-hover:scale-110 transition-transform duration-500 relative z-10">
                            <Upload className="h-12 w-12 text-white" />
                        </div>
                        <div className="space-y-3 relative z-10">
                            <p className="text-2xl font-black text-white tracking-tighter leading-none animate-in fade-in slide-in-from-bottom-2">
                                {isDragActive ? "¡Suéltalo!" : "Sube tu PDF aquí"}
                            </p>
                            <p className="text-[12px] text-white/50 font-black uppercase tracking-[0.2em]">Arrastra tu programa</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 animate-in zoom-in-95 duration-500">
                        <div className="flex items-center justify-between p-6 bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] rounded-[2.5rem] border border-neutral-100">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="p-4 bg-neutral-900 text-white rounded-2xl shadow-lg">
                                    <File className="h-8 w-8 shrink-0" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-base font-black text-neutral-900 truncate tracking-tight" title={files[0].name}>{files[0].name}</p>
                                    <p className="text-[11px] text-neutral-400 font-black uppercase tracking-widest mt-1">{(files[0].size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                            </div>
                            {status === 'idle' && (
                                <button onClick={removeFile} className="text-neutral-300 hover:text-red-500 hover:bg-neutral-50 rounded-full h-12 w-12 flex items-center justify-center transition-all">
                                    <X className="h-6 w-6" />
                                </button>
                            )}
                        </div>

                        {status === 'idle' && (
                            <Button
                                onClick={handleUpload}
                                className="w-full h-16 bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-primary hover:to-primary/80 text-white rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-xl shadow-black/20 active:scale-95 transition-all border border-white/10"
                            >
                                Iniciar Análisis IA 🚀
                            </Button>
                        )}

                        {status === 'processing' && (
                            <div className="flex items-center justify-center gap-4 p-6 bg-white shadow-2xl rounded-2xl border border-neutral-100">
                                <div className="h-8 w-8 border-[4px] border-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-[13px] font-black text-neutral-900 uppercase tracking-widest">{processingMessage}</span>
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-center gap-2 text-green-600 font-black text-xs p-5 bg-green-50 rounded-2xl border border-green-100 shadow-sm">
                                    <CheckCircle className="h-6 w-6" />
                                    ANÁLISIS COMPLETADO
                                </div>
                                <Button
                                    className="w-full h-16 bg-neutral-900 text-white hover:bg-neutral-800 rounded-2xl text-[13px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95"
                                    onClick={() => navigate(`/briefing/${documentId}`)}
                                >
                                    Abrir Briefing →
                                </Button>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="p-6 bg-red-50 rounded-2xl border border-red-100 shadow-sm space-y-4">
                                <p className="text-[12px] text-red-600 font-black uppercase tracking-widest text-center leading-tight">{uploadError}</p>
                                <Button variant="outline" size="sm" className="w-full h-12 border-red-200 text-red-600 hover:bg-red-100 text-[12px] font-black rounded-xl uppercase" onClick={() => setStatus('idle')}>
                                    REINTENTAR
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="w-full p-8 bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm">
            <h2 className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em] mb-6">Subir Documento</h2>

            {/* Dropzone Area */}
            <div
                {...getRootProps()}
                className={cn(
                    "border-2 border-dashed rounded-[2rem] p-8 text-center cursor-pointer transition-all duration-300",
                    isDragActive ? "border-primary bg-primary/5 scale-[0.98]" : "border-neutral-100 bg-neutral-50/50 hover:border-primary/30 hover:bg-neutral-50",
                    files.length > 0 ? "opacity-40 pointer-events-none" : ""
                )}
            >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4 text-neutral-400">
                    <div className="p-4 bg-white rounded-2xl shadow-sm">
                        <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-neutral-600">
                            {isDragActive ? "¡Suéltalo!" : "Sube tu PDF"}
                        </p>
                        <p className="text-[10px] uppercase font-black tracking-widest mt-1 opacity-50">Máx 10MB</p>
                    </div>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                <File className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-neutral-900 truncate">{files[0].name}</p>
                                <p className="text-[10px] text-neutral-400 font-medium">
                                    {(files[0].size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        </div>
                        {status !== 'uploading' && status !== 'processing' && status !== 'success' && (
                            <Button variant="ghost" size="icon" onClick={removeFile} className="h-8 w-8 rounded-full text-neutral-400 hover:text-red-500">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                        {status === 'idle' && (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={removeFile}>Cancelar</Button>
                                <Button
                                    onClick={handleUpload}
                                    disabled={!profile?.agency_id}
                                >
                                    {!profile?.agency_id ? "Cargando Perfil..." : "Iniciar Subida"}
                                </Button>
                            </div>
                        )}

                        {status === 'uploading' && (
                            <Button disabled className="gap-2">
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Subiendo...
                            </Button>
                        )}

                        {status === 'processing' && (
                            <div className="flex items-center gap-2 text-blue-600 font-medium bg-blue-50 px-4 py-2 rounded-md border border-blue-100">
                                <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                {processingMessage}
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="flex flex-col gap-4 w-full animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-2 text-green-600 font-bold text-sm">
                                    <CheckCircle className="h-4 w-4" />
                                    Análisis Completado
                                </div>
                                {briefing && (
                                    <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100 shadow-sm space-y-3">
                                        <p className="font-black text-sm text-neutral-900 tracking-tight leading-tight">{briefing.title}</p>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Público Objetivo</p>
                                            <p className="text-xs text-neutral-600 leading-snug">{briefing.target_audience}</p>
                                        </div>
                                    </div>
                                )}
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="text-[10px] text-neutral-400 uppercase tracking-widest h-auto p-0 hover:text-primary transition-colors font-black"
                                    onClick={removeFile}
                                >
                                    Limpiar y subir otro
                                </Button>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2 text-red-600 font-medium">
                                    <AlertCircle className="h-5 w-5" />
                                    Error
                                </div>
                                <p className="text-[10px] text-red-500 max-w-[200px] text-right">{uploadError}</p>
                                <Button variant="outline" size="sm" onClick={() => setStatus('idle')}>
                                    Reintentar
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
