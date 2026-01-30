import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, FileText, Target, ListChecks, Layers, Clock, Sparkles, ChevronLeft, Share2, Palette, Globe, FileDown, Check, ArrowRight, Trash2, Eye, Loader2, MapPin, BookOpen, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Document } from './DocumentList';

type Tone = 'Profesional' | 'Cercano' | 'Persuasivo' | 'Inspirador';
type Format = 'Web' | 'PDF';

export function BriefingPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [document, setDocument] = useState<Document | null>(null);
    const [loading, setLoading] = useState(true);

    // Proposal Configuration State
    const [showConfig, setShowConfig] = useState(false);
    const [tone, setTone] = useState<Tone>('Profesional');
    const [format, setFormat] = useState<Format>('Web');
    const [isGenerating, setIsGenerating] = useState(false);
    const [existingProposals, setExistingProposals] = useState<any[]>([]);
    const [showChangeProgramModal, setShowChangeProgramModal] = useState(false);

    // New generation options
    const [includeInstitution, setIncludeInstitution] = useState(true);
    const [includeLocation, setIncludeLocation] = useState(true);
    const [ctaType, setCtaType] = useState<'popup' | 'whatsapp' | 'web'>('popup');
    const [ctaValue, setCtaValue] = useState('');

    // Regeneration State
    const [showRegenerateModal, setShowRegenerateModal] = useState(false);
    const [editContext, setEditContext] = useState('');
    const [editLanguage, setEditLanguage] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

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

                // Fetch existing proposals
                const { data: props, error: propsError } = await supabase
                    .from('proposals')
                    .select('*')
                    .eq('document_id', id)
                    .order('created_at', { ascending: false });

                if (!propsError) setExistingProposals(props || []);

                // Initialize edit state
                setEditContext(data.additional_context || '');
                setEditLanguage(data.output_language || 'es');

            } catch (error) {
                console.error('Error fetching document:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchDocument();

        // Realtime listener for this specific document
        const channel = supabase
            .channel(`briefing-${id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'documents',
                    filter: `id=eq.${id}`,
                },
                (payload) => {
                    console.log('BriefingPage: Real-time update', payload.new.status, payload.new.metadata);
                    setDocument(payload.new as Document);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    const handleDeleteProposal = async (e: React.MouseEvent, propId: string) => {
        e.stopPropagation();
        if (!confirm('¿Estás seguro de eliminar esta propuesta?')) return;

        try {
            const { error } = await supabase
                .from('proposals')
                .delete()
                .eq('id', propId);

            if (error) throw error;
            setExistingProposals(prev => prev.filter(p => p.id !== propId));
        } catch (error: any) {
            console.error('Error deleting proposal:', error);
            alert('Error al eliminar: ' + error.message);
        }
    };

    const handleSelectProgram = async (program: any) => {
        if (!document) return;
        setLoading(true);
        try {
            // Disparamos la extracción profunda a través de la Edge Function
            const { error } = await supabase.functions.invoke('process-document', {
                body: {
                    id: document.id,
                    storage_path: document.storage_path,
                    program_title: program.title,
                    output_language: editLanguage || document.output_language
                }
            });

            if (error) throw error;

            // Liberamos el loading local para que el estado 'processing' de la DB (gestionado por Realtime) tome el control de la UI
            setLoading(false);

            // La UI entrará en estado de "processing" automáticamente por el realtime listener
        } catch (error: any) {
            console.error('Error selecting program:', error);
            setLoading(false);
            const errorMsg = error.message || (typeof error === 'string' ? error : 'Error desconocido');
            alert(`Error al iniciar la extracción profunda: ${errorMsg}`);
        }
    };

    const handleGenerateProposal = async () => {
        if (!document) return;
        setIsGenerating(true);

        try {
            const { data, error } = await supabase
                .from('proposals')
                .insert({
                    document_id: document.id,
                    agency_id: document.agency_id, // Link to agency
                    format,
                    tone,
                    status: 'processing'
                })
                .select()
                .single();

            if (error) throw error;

            setShowConfig(false);
            // Navigate immediately
            navigate(`/proposal/${data.id}`);

            // Call function in background WITHOUT blocking UI or alerting on 401/500
            // The ProposalPage has its own realtime listener to show the result
            supabase.functions.invoke('generate-proposal', {
                body: {
                    proposal_id: data.id,
                    options: {
                        include_institution: includeInstitution,
                        include_location: includeLocation,
                        cta_config: format === 'Web' ? { type: ctaType, value: ctaValue } : null
                    }
                }
            }).catch(e => {
                console.error('Background generation error:', e);
            }).finally(() => {
                setIsGenerating(false);
            });

        } catch (error: any) {
            console.error('Error initiating proposal:', error);
            setIsGenerating(false);
        }
    };

    const handleRegenerate = async () => {
        if (!document) return;
        setIsUpdating(true);
        try {
            // 1. Update document settings and reset briefing
            const { error: updateError } = await supabase
                .from('documents')
                .update({
                    additional_context: editContext,
                    output_language: editLanguage,
                    briefing: null,
                    status: 'processing'
                })
                .eq('id', document.id);

            if (updateError) throw updateError;

            // 2. Trigger worker
            const { error: invokeError } = await supabase.functions.invoke('process-document', {
                body: {
                    id: document.id,
                    storage_path: document.storage_path,
                    output_language: editLanguage,
                    // Si ya tenía un briefing, es que ya seleccionó un programa. 
                    // Si es un catálogo, intentamos recuperar el título del briefing previo si existe
                    program_title: (document.briefing as any)?.title || null
                }
            });

            if (invokeError) throw invokeError;

            setShowRegenerateModal(false);
        } catch (error: any) {
            console.error('Error regenerating briefing:', error);
            alert('Error al regenerar: ' + error.message);
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground font-medium animate-pulse">Cargando briefing educativo...</p>
            </div>
        );
    }

    // Special case for "Processing" state with granular message
    if (document?.status === 'processing') {
        const metadata = (document as any).metadata;
        const message = metadata?.message || 'Analizando documento...';

        return (
            <div className="flex flex-col items-center justify-center h-screen gap-6 p-4 text-center bg-neutral-900 text-white">
                <div className="relative">
                    <div className="h-24 w-24 border-[6px] border-primary/20 border-t-primary rounded-full animate-spin" />
                    <Sparkles className="h-8 w-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="space-y-3 max-w-md">
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Trabajando en tu {document.available_programs?.length ? 'Catálogo' : 'Documento'}</h2>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{message}</p>
                    </div>
                    <p className="text-sm text-neutral-500 font-medium pt-4 leading-relaxed">
                        Estamos extrayendo la estructura del programa. <br />
                        {document.available_programs?.length ? `Ya hemos detectado ${document.available_programs.length} programas.` : 'Esto suele tardar unos 10-15 segundos.'}
                    </p>
                </div>
                <Button variant="ghost" className="text-neutral-500 hover:text-white" onClick={() => navigate('/')}>Volver al Panel</Button>
            </div>
        );
    }

    if (!document || (!document.briefing && !document.available_programs)) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-6 p-4 text-center">
                <div className="p-4 bg-amber-50 text-amber-600 rounded-full">
                    <Clock className="h-10 w-10 animate-pulse" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Documento en espera</h2>
                    <p className="text-muted-foreground">No hemos podido encontrar información. Por favor, intenta subir el archivo de nuevo.</p>
                </div>
                <Button variant="outline" onClick={() => navigate('/')}>Volver al Panel</Button>
            </div>
        );
    }

    // --- SELECTION UI: If briefing is null but available_programs exists ---
    if (!document.briefing && document.available_programs && Array.isArray(document.available_programs) && document.available_programs.length > 0) {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4 lg:p-8">
                <div className="max-w-4xl w-full space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-bold border border-primary/20">
                            <Layers className="h-4 w-4" />
                            Catálogo/Brochure Detectado
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-neutral-900 tracking-tight">
                            Hemos encontrado {document.available_programs.length} programas
                        </h1>
                        <p className="text-muted-foreground text-lg max-w-2xl mx-auto font-medium">
                            Selecciona sobre cuál de ellos quieres generar la propuesta comercial hoy.
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                        {document.available_programs.map((prog: any, i: number) => (
                            <div
                                key={i}
                                onClick={() => handleSelectProgram(prog)}
                                className="group bg-white p-8 rounded-[2.5rem] border-2 border-transparent hover:border-primary/40 shadow-xl hover:shadow-2xl transition-all cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
                                <div className="relative space-y-6">
                                    <div className="space-y-3">
                                        <h3 className="text-2xl font-black text-neutral-900 leading-tight group-hover:text-primary transition-colors">
                                            {prog.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground font-medium line-clamp-3">
                                            {prog.summary || prog.target_audience}
                                        </p>
                                    </div>
                                    <div className="pt-4 flex items-center gap-3 text-primary text-sm font-bold">
                                        Seleccionar Programa
                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="text-center pt-8">
                        <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground">
                            Cancelar y volver
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Normalización de datos para evitar errores de renderizado
    let briefing = document.briefing || {};
    if (Array.isArray(briefing)) {
        briefing = briefing[0] || {};
    }

    const {
        title = "Sin Título",
        objectives = [],
        modules = [],
        key_highlights = [],
        target_audience = "No especificado",
        duration = "Consultar"
    } = briefing;

    return (
        <div className="min-h-screen bg-neutral-50/50">
            {/* Navigation Header */}
            <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b px-4 lg:px-8 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/')}
                            className="gap-2 text-muted-foreground hover:text-primary transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Volver al Panel
                        </Button>

                        {document.available_programs && document.available_programs.length > 1 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowChangeProgramModal(true)}
                                className="gap-2 text-primary hover:bg-primary/5 font-bold"
                            >
                                <Layers className="h-4 w-4" />
                                Cambiar Programa
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/viewer/${id}`)}
                            className="gap-2 bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                        >
                            <Eye className="h-4 w-4" />
                            Ver PDF
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowRegenerateModal(true)}
                            className="gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        >
                            <Sparkles className="h-4 w-4" />
                            Regenerar Briefing
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
                            <Share2 className="h-4 w-4" />
                            Compartir
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-4 lg:p-8 space-y-8 pb-20">
                {/* Hero Section */}
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-3 text-sm font-medium text-primary bg-primary/10 w-fit px-4 py-1.5 rounded-full border border-primary/20">
                        <Sparkles className="h-4 w-4" />
                        Briefing Generado por IA
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-3xl lg:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
                            {title}
                        </h1>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm">{document.filename}</span>
                        </div>
                    </div>

                    {document.additional_context && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-left-4 duration-500 delay-300">
                            <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Instrucción Adicional</p>
                                <p className="text-sm text-amber-800 font-medium leading-relaxed italic">
                                    "{document.additional_context}"
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid gap-8 lg:grid-cols-12">
                    {/* Main Content (Left/Center) */}
                    <div className="lg:col-span-8 space-y-10">
                        {/* Objectives */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-lg font-bold text-neutral-800">
                                <ListChecks className="h-5 w-5 text-primary" />
                                Objetivos del Programa
                            </div>
                            {objectives.length > 0 ? (
                                <div className="grid gap-3">
                                    {objectives.map((obj: string, i: number) => (
                                        <div key={i} className="flex gap-4 p-4 bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all group">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs flex items-center justify-center font-bold border border-blue-100">
                                                {i + 1}
                                            </span>
                                            <p className="text-sm text-neutral-600 leading-relaxed group-hover:text-neutral-900 transition-colors">
                                                {obj}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic px-2">No se han extraído objetivos específicos.</p>
                            )}
                        </section>

                        {/* Modules */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-lg font-bold text-neutral-800">
                                <Layers className="h-5 w-5 text-primary" />
                                Estructura de Módulos
                            </div>
                            {modules.length > 0 ? (
                                <div className="space-y-4">
                                    {modules.map((mod: any, i: number) => {
                                        // Robust handling of module content
                                        const name = typeof mod === 'string' ? mod : (mod.name || `Módulo ${i + 1}`);
                                        const summary = typeof mod === 'string' ? "" : (mod.summary || "");

                                        return (
                                            <div key={i} className="p-6 bg-white rounded-2xl border shadow-sm hover:border-primary/20 transition-all">
                                                <h4 className="font-bold text-base mb-2 text-neutral-900">
                                                    {name}
                                                </h4>
                                                {summary && (
                                                    <p className="text-sm text-neutral-500 leading-relaxed">
                                                        {summary}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic px-2">Estructura de módulos no detectada.</p>
                            )}
                        </section>
                    </div>

                    {/* Sidebar Details (Right) */}
                    <aside className="lg:col-span-4">
                        <div className="sticky top-24 space-y-6">
                            <div className="flex flex-col gap-3">
                                <Button
                                    onClick={() => setShowConfig(true)}
                                    className="w-full bg-[#ffbd59] hover:bg-[#ffbd59]/90 text-black font-black h-14 rounded-2xl group transition-all active:scale-95 shadow-lg shadow-[#ffbd59]/20 flex items-center justify-center gap-3 uppercase tracking-wider border-none"
                                >
                                    <Sparkles className="h-5 w-5" />
                                    Generar Propuesta
                                </Button>

                                {existingProposals.length > 0 && (
                                    <Button
                                        onClick={() => window.document.getElementById('proposals-block')?.scrollIntoView({ behavior: 'smooth' })}
                                        className="w-full bg-[#ffbd59] hover:bg-[#ffbd59]/90 text-black font-black h-14 rounded-2xl group transition-all active:scale-95 shadow-lg shadow-[#ffbd59]/20 flex items-center justify-center gap-3 uppercase tracking-wider border-none"
                                    >
                                        <Eye className="h-5 w-5" />
                                        Ver Propuestas
                                    </Button>
                                )}
                            </div>

                            {/* Highlights Card */}
                            <div className="p-8 bg-neutral-900 text-white rounded-3xl shadow-xl space-y-6 border border-white/5">
                                <div className="flex items-center gap-2 text-white font-black tracking-[0.2em] uppercase text-[10px]">
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    Puntos Clave
                                </div>
                                <div className="space-y-4">
                                    {key_highlights.length > 0 ? (
                                        key_highlights.map((hl: string, i: number) => (
                                            <div key={i} className="flex gap-3 items-start group">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0 group-hover:scale-150 transition-transform" />
                                                <p className="text-sm text-neutral-300 leading-relaxed group-hover:text-white transition-colors">
                                                    {hl}
                                                </p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-neutral-500 italic">No hay puntos clave disponibles.</p>
                                    )}
                                </div>

                                <hr className="border-neutral-800" />

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                                            <Target className="h-3 w-3" />
                                            Público
                                        </div>
                                        <p className="text-sm font-medium">{target_audience}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                                            <Clock className="h-3 w-3" />
                                            Duración
                                        </div>
                                        <p className="text-sm font-medium">{duration}</p>
                                    </div>
                                </div>
                            </div>


                            {/* Location Info */}
                            {(briefing.location?.city || briefing.location?.country) && briefing.location.city !== "No especificado" && (
                                <div className="bg-neutral-50 rounded-[2rem] p-6 border border-neutral-100 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                        <MapPin className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">Localización</p>
                                        <p className="text-sm font-bold text-neutral-900 leading-tight">
                                            {[briefing.location.city, briefing.location.country].filter(c => c && c !== "No especificado").join(', ')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>

                {/* Generated Proposals Section - NEW LOCATION */}
                {existingProposals.length > 0 && (
                    <div id="proposals-block" className="space-y-8 pt-12 border-t mt-12 w-full">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-3">
                                    <Sparkles className="h-6 w-6 text-primary" />
                                    Tus Propuestas Generadas
                                </h3>
                                <p className="text-xs text-neutral-500 font-medium">Modelos de marketing listos para usar</p>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {existingProposals.map((prop) => (
                                <div
                                    key={prop.id}
                                    className="group p-6 bg-white border border-neutral-100 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-primary/20 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-6 relative overflow-hidden"
                                >
                                    {/* Center: Info */}
                                    <div className="flex-1 min-w-0 space-y-2 cursor-pointer" onClick={() => navigate(`/proposal/${prop.id}`)}>
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                                {prop.format || 'WEB'}
                                            </div>
                                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest truncate">
                                                Tono {prop.tone} • {new Date(prop.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                        <h4 className="text-lg font-black text-neutral-900 leading-tight group-hover:text-primary transition-colors truncate">
                                            {prop.content?.headline || 'Propuesta sin título'}
                                        </h4>
                                    </div>

                                    {/* Right Side: Actions */}
                                    <div className="flex items-center gap-3 self-end sm:self-center">
                                        <button
                                            onClick={(e) => handleDeleteProposal(e, prop.id)}
                                            className="p-3 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                        <Button
                                            onClick={() => navigate(`/proposal/${prop.id}`)}
                                            variant="outline"
                                            className="rounded-2xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 font-bold h-12 px-6 gap-2"
                                        >
                                            Ver Propuesta
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main >

            {/* Proposal Configuration Modal */}
            {
                showConfig && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                            <header className="p-6 border-b flex justify-between items-center bg-neutral-50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                        <Palette className="h-5 w-5" />
                                    </div>
                                    <h3 className="font-bold text-lg">Configurar Propuesta</h3>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setShowConfig(false)} className="rounded-full">
                                    <X className="h-5 w-5" />
                                </Button>
                            </header>

                            <div className="p-8 space-y-8">
                                {/* Format Selection */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Formato de Salida</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setFormat('Web')}
                                            className={cn(
                                                "flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                                                format === 'Web' ? "border-primary bg-primary/5 text-primary shadow-inner" : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <Globe className="h-6 w-6" />
                                            <span className="text-sm font-bold">Página Web</span>
                                        </button>
                                        <button
                                            onClick={() => setFormat('PDF')}
                                            className={cn(
                                                "flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                                                format === 'PDF' ? "border-primary bg-primary/5 text-primary shadow-inner" : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <FileDown className="h-6 w-6" />
                                            <span className="text-sm font-bold">Documento PDF</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Tone Selection */}
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tono de la Comunicación</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['Profesional', 'Cercano', 'Persuasivo', 'Inspirador'] as Tone[]).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => setTone(t)}
                                                className={cn(
                                                    "px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left flex justify-between items-center",
                                                    tone === t ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20" : "border-border bg-white text-muted-foreground hover:border-primary/30"
                                                )}
                                            >
                                                {t}
                                                {tone === t && <Check className="h-4 w-4" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Advanced Options */}
                                <div className="space-y-4 pt-4 border-t border-dotted">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Opciones de Contenido</label>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center text-neutral-600">
                                                    <BookOpen className="h-4 w-4" />
                                                </div>
                                                <span className="text-sm font-bold text-neutral-800">Intro de la Institución</span>
                                            </div>
                                            <button
                                                onClick={() => setIncludeInstitution(!includeInstitution)}
                                                className={cn(
                                                    "w-10 h-6 rounded-full transition-all relative",
                                                    includeInstitution ? "bg-primary" : "bg-neutral-200"
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                                                    includeInstitution ? "left-5" : "left-1"
                                                )} />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center text-neutral-600">
                                                    <MapPin className="h-4 w-4" />
                                                </div>
                                                <span className="text-sm font-bold text-neutral-800">Localización geográfica</span>
                                            </div>
                                            <button
                                                onClick={() => setIncludeLocation(!includeLocation)}
                                                className={cn(
                                                    "w-10 h-6 rounded-full transition-all relative",
                                                    includeLocation ? "bg-primary" : "bg-neutral-200"
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                                                    includeLocation ? "left-5" : "left-1"
                                                )} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* CTA Configuration for Web */}
                                {format === 'Web' && (
                                    <div className="space-y-4 pt-4 border-t border-dotted">
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Call to Action (Botón principal)</label>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { id: 'popup', label: 'Formulario', icon: MessageSquare },
                                                    { id: 'web', label: 'Página Web', icon: Globe },
                                                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare }
                                                ].map((cta) => (
                                                    <button
                                                        key={cta.id}
                                                        onClick={() => setCtaType(cta.id as any)}
                                                        className={cn(
                                                            "flex flex-col items-center gap-2 p-3 rounded-xl border text-[10px] font-black uppercase transition-all",
                                                            ctaType === cta.id ? "border-primary bg-primary/5 text-primary" : "border-neutral-100 bg-white text-neutral-400"
                                                        )}
                                                    >
                                                        <cta.icon className="h-4 w-4" />
                                                        {cta.label}
                                                    </button>
                                                ))}
                                            </div>

                                            {ctaType !== 'popup' && (
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{ctaType === 'whatsapp' ? 'Número WhatsApp' : 'URL de destino'}</p>
                                                    <input
                                                        type="text"
                                                        value={ctaValue}
                                                        onChange={(e) => setCtaValue(e.target.value)}
                                                        placeholder={ctaType === 'whatsapp' ? '+34600123456' : 'https://ejemplo.com'}
                                                        className="w-full p-4 bg-neutral-50 border border-neutral-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <Button
                                    onClick={handleGenerateProposal}
                                    disabled={isGenerating}
                                    className="w-full h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-lg shadow-xl disabled:opacity-50"
                                >
                                    {isGenerating ? (
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Procesando...
                                        </div>
                                    ) : (
                                        <>
                                            ¡Generar Ahora!
                                            <Sparkles className="ml-2 h-5 w-5 text-primary" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Regeneration Modal */}
            {
                showRegenerateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <header className="p-8 border-b flex justify-between items-center bg-neutral-900 text-white">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-primary/20 rounded-2xl text-primary">
                                        <Sparkles className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl tracking-tight">Refinar Análisis IA</h3>
                                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Ajusta las instrucciones y el idioma</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setShowRegenerateModal(false)} className="rounded-full hover:bg-white/10 text-white">
                                    <X className="h-6 w-6" />
                                </Button>
                            </header>

                            <div className="p-8 space-y-8">
                                <div className="space-y-4">
                                    <label className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                                        <Globe className="h-3 w-3" />
                                        Cambiar Idioma de Salida
                                    </label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {[
                                            { code: 'es', label: 'ES' },
                                            { code: 'ca', label: 'CAT' },
                                            { code: 'gl', label: 'GL' },
                                            { code: 'en', label: 'EN' },
                                            { code: 'fr', label: 'FR' },
                                            { code: 'de', label: 'DE' },
                                            { code: 'pt', label: 'PT' }
                                        ].map((lang) => (
                                            <button
                                                key={lang.code}
                                                onClick={() => setEditLanguage(lang.code)}
                                                className={cn(
                                                    "flex items-center justify-center p-3 rounded-2xl border-2 transition-all text-center h-12",
                                                    editLanguage === lang.code
                                                        ? "border-primary bg-primary/10 text-primary shadow-inner ring-2 ring-primary/20"
                                                        : "border-neutral-50 bg-neutral-50/50 text-neutral-500 hover:border-neutral-200"
                                                )}
                                            >
                                                <span className="text-sm font-black tracking-tighter">{lang.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                                        <FileText className="h-3 w-3" />
                                        Actualizar Contexto / Instrucciones
                                    </label>
                                    <textarea
                                        value={editContext}
                                        onChange={(e) => setEditContext(e.target.value)}
                                        placeholder="Ej: 'Resalta más los módulos técnicos' o 'Usa un tono más comercial'."
                                        className="w-full min-h-[120px] p-6 bg-neutral-50 border-2 border-neutral-100 rounded-[2rem] text-sm font-medium focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none resize-none"
                                    />
                                    <p className="text-[10px] text-neutral-400 font-bold leading-relaxed italic">
                                        * Al regenerar, la IA volverá a leer el PDF usando estas nuevas pautas. El análisis actual se reemplazará.
                                    </p>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowRegenerateModal(false)}
                                        className="flex-1 h-14 rounded-2xl font-bold"
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        onClick={handleRegenerate}
                                        disabled={isUpdating}
                                        className="flex-[2] h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold"
                                    >
                                        {isUpdating ? (
                                            <div className="flex items-center gap-2">
                                                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Actualizando...
                                            </div>
                                        ) : (
                                            <>Regenerar Análisis AI</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Change Program Confirmation Modal */}
            {
                showChangeProgramModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="p-8 text-center space-y-6">
                                <div className="mx-auto w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                                    <Layers className="h-10 w-10" />
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-neutral-900 tracking-tight">¿Cambiar de Programa?</h3>
                                    <p className="text-sm text-neutral-500 font-medium leading-relaxed">
                                        Vas a volver a la selección de programas de este catálogo. <br />
                                        <span className="text-red-500 font-bold">Se perderá el análisis actual de este programa.</span>
                                    </p>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowChangeProgramModal(false)}
                                        className="flex-1 h-14 rounded-2xl font-bold"
                                    >
                                        No, volver
                                    </Button>
                                    <Button
                                        onClick={async () => {
                                            setLoading(true);
                                            setShowChangeProgramModal(false);
                                            try {
                                                await supabase.from('documents').update({ briefing: null }).eq('id', id);
                                                setDocument(prev => prev ? { ...prev, briefing: null } : null);
                                            } catch (e) {
                                                console.error(e);
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="flex-1 h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold"
                                    >
                                        Sí, cambiar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
