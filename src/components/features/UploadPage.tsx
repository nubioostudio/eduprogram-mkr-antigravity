import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    Upload,
    Globe,
    MessageSquare,
    Sparkles,
    FileText,
    X,
    CheckCircle,
    Info,
    ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useDropzone } from 'react-dropzone';

type Language = {
    code: string;
    label: string;
    flag: string;
};

const LANGUAGES: Language[] = [
    { code: 'es', label: 'ES', flag: '' },
    { code: 'ca', label: 'CAT', flag: '' },
    { code: 'gl', label: 'GL', flag: '' },
    { code: 'en', label: 'EN', flag: '' },
    { code: 'fr', label: 'FR', flag: '' },
    { code: 'de', label: 'DE', flag: '' },
    { code: 'pt', label: 'PT', flag: '' },
];

const CONTEXT_TIPS = [
    "Foco en ROI y empleabilidad (India)",
    "Resaltar prestigio y seguridad (China/Japón)",
    "Tono cercano para mercado local (CCAA)",
    "Enfoque para perfiles corporativos",
    "Campaña limitada hasta mayo"
];

export function UploadPage() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [file, setFile] = useState<File | null>(null);
    const [language, setLanguage] = useState('es');
    const [context, setContext] = useState('');
    const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [uploadError, setUploadError] = useState<string | null>(null);

    const onDrop = (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            setUploadError(null);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1
    });

    const handleUpload = async () => {
        if (!file || !profile?.agency_id) return;

        setStatus('uploading');
        setUploadError(null);

        try {
            // 1. Upload to Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: storageError } = await supabase.storage
                .from('documents')
                .upload(filePath, file);

            if (storageError) throw storageError;

            // 2. Create DB Record with new metadata
            const { data, error: dbError } = await supabase
                .from('documents')
                .insert({
                    agency_id: profile.agency_id,
                    filename: file.name,
                    storage_path: filePath,
                    status: 'pending',
                    output_language: language,
                    additional_context: context
                })
                .select()
                .single();

            if (dbError) throw dbError;

            setStatus('success');

            // Redirect to briefing after a short delay
            setTimeout(() => {
                navigate(`/briefing/${data.id}`);
            }, 1500);

        } catch (err: any) {
            console.error('Upload error:', err);
            setStatus('error');
            setUploadError(err.message || 'Error al subir el archivo');
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFDFF] selection:bg-primary/10">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-neutral-100 z-40 px-6 lg:px-12 flex items-center justify-between">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="gap-2 text-neutral-500 hover:text-neutral-900 font-bold"
                >
                    <ChevronLeft className="h-5 w-5" />
                    Volver al Panel
                </Button>

                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="text-sm font-black uppercase tracking-tighter">Nueva Propuesta IA</span>
                </div>
            </header>

            <main className="pt-32 pb-20 px-6 max-w-6xl mx-auto">
                <div className="grid lg:grid-cols-2 gap-16 items-start">

                    {/* Left Column: Config */}
                    <div className="space-y-10 animate-in fade-in slide-in-from-left-8 duration-700">
                        <div className="space-y-4">
                            <h1 className="text-5xl font-black text-neutral-900 tracking-tighter leading-none">
                                Configura tu <br /> <span className="text-primary italic">Análisis</span>
                            </h1>
                            <p className="text-lg text-neutral-500 font-medium max-w-md">
                                Personaliza cómo quieres que la IA procese el documento para obtener mejores resultados.
                            </p>
                        </div>

                        <div className="space-y-8 bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm">
                            {/* Language Selector */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[11px] font-black text-neutral-400 uppercase tracking-widest">
                                    <Globe className="h-3 w-3" />
                                    Idioma de Salida
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {LANGUAGES.map((lang) => (
                                        <button
                                            key={lang.code}
                                            onClick={() => setLanguage(lang.code)}
                                            className={cn(
                                                "flex items-center justify-center p-3 rounded-2xl border-2 transition-all text-center h-12",
                                                language === lang.code
                                                    ? "border-primary bg-primary/10 text-primary shadow-inner ring-2 ring-primary/20"
                                                    : "border-neutral-50 bg-neutral-50/50 text-neutral-500 hover:border-neutral-200"
                                            )}
                                        >
                                            <span className="text-sm font-black tracking-tighter">{lang.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Additional Context */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-[11px] font-black text-neutral-400 uppercase tracking-widest">
                                        <MessageSquare className="h-3 w-3" />
                                        Contexto Adicional
                                    </div>
                                    <div className="group relative">
                                        <Info className="h-4 w-4 text-neutral-300 cursor-help" />
                                        <div className="absolute bottom-full right-0 mb-2 w-64 p-4 bg-neutral-900 text-white text-[10px] rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed font-medium">
                                            Añade detalles sobre la campaña, el público específico o cualquier requisito que deba tener en cuenta el briefing.
                                        </div>
                                    </div>
                                </div>
                                <textarea
                                    value={context}
                                    onChange={(e) => setContext(e.target.value)}
                                    placeholder="Añade instrucciones adicionales para la IA..."
                                    className="w-full h-32 p-6 bg-neutral-50 border-neutral-100 rounded-[1.5rem] text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none outline-none"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {CONTEXT_TIPS.map((tip, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setContext(prev => prev ? prev + ' ' + tip : tip)}
                                            className="text-[10px] bg-neutral-100 text-neutral-500 px-3 py-1.5 rounded-full hover:bg-neutral-200 transition-colors font-bold"
                                        >
                                            {tip}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Upload */}
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
                        {status !== 'success' ? (
                            <div className="space-y-6">
                                <div
                                    {...getRootProps()}
                                    className={cn(
                                        "relative group overflow-hidden border-4 border-dashed rounded-[3.5rem] p-12 lg:p-20 text-center cursor-pointer transition-all duration-700 aspect-square flex flex-col items-center justify-center",
                                        isDragActive
                                            ? "border-primary bg-primary/5 scale-[0.98]"
                                            : "border-neutral-200 bg-white hover:border-primary/40 hover:bg-neutral-50/50 shadow-2xl shadow-neutral-200/50",
                                        status === 'uploading' && "opacity-50 pointer-events-none"
                                    )}
                                >
                                    <input {...getInputProps()} />
                                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                    <div className="mb-8 p-10 bg-neutral-900 text-white rounded-[2.5rem] shadow-2xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 relative z-10">
                                        <Upload className="h-16 w-16" />
                                    </div>

                                    <div className="space-y-4 relative z-10">
                                        <h3 className="text-3xl font-black text-neutral-900 tracking-tighter leading-none">
                                            {isDragActive ? "¡Suéltalo ya! 🚀" : "Sube tu Programa Educativo"}
                                        </h3>
                                        <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
                                            PDF hasta 10MB • Solo archivos originales
                                        </p>
                                    </div>

                                    {file && (
                                        <div className="mt-12 p-6 bg-neutral-900 text-white rounded-3xl flex items-center gap-6 animate-in zoom-in-95 duration-500 relative z-20">
                                            <div className="p-3 bg-white/10 rounded-xl">
                                                <FileText className="h-6 w-6" />
                                            </div>
                                            <div className="text-left min-w-0 flex-1">
                                                <p className="text-sm font-black truncate">{file.name}</p>
                                                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                disabled={status === 'uploading'}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setFile(null);
                                                }}
                                                className="hover:bg-white/10 rounded-full"
                                            >
                                                <X className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {file && (
                                    <Button
                                        onClick={handleUpload}
                                        disabled={status === 'uploading'}
                                        className="w-full h-20 bg-primary hover:bg-primary/90 text-white rounded-[2rem] text-xl font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all group"
                                    >
                                        {status === 'uploading' ? (
                                            <div className="flex items-center gap-4">
                                                <div className="h-6 w-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Subiendo...</span>
                                            </div>
                                        ) : (
                                            <>
                                                Comenzar Análisis IA
                                                <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-2 transition-transform" />
                                            </>
                                        )}
                                    </Button>
                                )}

                                {status === 'error' && (
                                    <div className="p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 text-red-600 animate-in shake duration-500">
                                        <X className="h-6 w-6 shrink-0" />
                                        <p className="text-sm font-bold">{uploadError}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-20 bg-white border-4 border-neutral-100 rounded-[3.5rem] min-h-[500px] text-center space-y-8 animate-in zoom-in-95 duration-700">
                                <div className="h-32 w-32 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-green-500/20">
                                    <CheckCircle className="h-16 w-16" />
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-4xl font-black text-neutral-900 tracking-tighter">¡Documento Listo!</h3>
                                    <p className="text-lg text-neutral-500 font-medium">
                                        Redirigiéndote al área de análisis...
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-neutral-300">
                                    <div className="h-1.5 w-12 bg-neutral-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 animate-[loading_1.5s_ease-in-out_infinite]" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    );
}
