import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Sparkles, Send, Loader2, CheckCircle2, AlertCircle, Wand2, ArrowRight, Palette, Maximize, Minimize, MessageSquare, Bot, Sparkle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '@/lib/utils';

function getContrastColor(hexColor: string) {
    if (!hexColor) return '#ffffff';
    const color = hexColor.replace('#', '');
    const r = parseInt(color.slice(0, 2), 16);
    const g = parseInt(color.slice(2, 4), 16);
    const b = parseInt(color.slice(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

export function ProposalPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [proposal, setProposal] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isFullWidth, setIsFullWidth] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
    const proposalRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatMessages, showChat]);

    const handleDownloadPDF = async () => {
        if (!proposalRef.current) return;

        try {
            const canvas = await html2canvas(proposalRef.current, {
                scale: 3,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 1200
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgHeightInPdf = (imgProps.height * pdfWidth) / imgProps.width;

            let heightLeft = imgHeightInPdf;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightInPdf);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeightInPdf;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightInPdf);
                heightLeft -= pdfHeight;
            }

            pdf.save(`Propuesta_${proposal?.documents?.filename || 'EduTech'}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF.');
        }
    };

    useEffect(() => {
        async function fetchProposal() {
            if (!id) return;
            const { data, error } = await supabase
                .from('proposals')
                .select('*, documents(filename, briefing, agency_id, agencies(name, logo_url, primary_color))')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching proposal:', error);
            } else {
                setProposal(data);
                if (data.status === 'ready') setLoading(false);
            }
        }

        fetchProposal();

        const channel = supabase
            .channel(`proposal-${id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'proposals',
                filter: `id=eq.${id}`
            }, (payload) => {
                setProposal((prev: any) => ({ ...prev, ...payload.new }));
                if (payload.new.status === 'ready') {
                    setLoading(false);
                    fetchProposal();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isChatting) return;

        const userMsg = chatInput;
        setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setChatInput('');
        setIsChatting(true);

        try {
            const { error } = await supabase.functions.invoke('edit-proposal', {
                body: { proposal_id: id, instruction: userMsg }
            });

            if (error) throw error;
            setChatMessages(prev => [...prev, { role: 'ai', text: '¡Propuesta actualizada!' }]);
        } catch (error: any) {
            console.error('Chat error:', error);
            setChatMessages(prev => [...prev, { role: 'ai', text: 'Error al aplicar cambios.' }]);
        } finally {
            setIsChatting(false);
        }
    };

    if (loading || (proposal && proposal.status === 'processing')) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center space-y-12">
                <div className="relative">
                    <div className="h-40 w-40 rounded-full border-4 border-neutral-100 flex items-center justify-center">
                        <Wand2 className="h-16 w-16 text-neutral-300 animate-pulse" />
                    </div>
                    <div className="absolute inset-0 h-40 w-40 rounded-full border-[6px] border-primary border-t-transparent animate-spin" />
                </div>

                <div className="max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="space-y-3">
                        <h2 className="text-4xl font-black text-neutral-900 leading-tight">Redactando tu propuesta...</h2>
                        <p className="text-neutral-500 font-medium leading-relaxed">
                            Nuestro experto de IA está usando la Skill de Marketing Educativo para transformar el briefing en una propuesta persuasiva.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-pulse rounded-full w-2/3" />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                            <span className="flex items-center gap-2">
                                <Sparkles className="h-3 w-3 text-primary" />
                                MODO AIDA ACTIVO
                            </span>
                            <span>{proposal?.tone?.toUpperCase() || 'PROCESANDO'}</span>
                        </div>
                    </div>

                    <div className="pt-12">
                        <Button
                            variant="ghost"
                            onClick={() => navigate('/')}
                            className="text-neutral-400 hover:text-neutral-900 font-bold uppercase tracking-widest text-[10px] gap-2"
                        >
                            <ChevronLeft className="h-3 w-3" />
                            Volver al Panel de Control
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (proposal?.status === 'error') {
        const errorMessage = proposal.content?.error || 'Hubo un problema.';
        return (
            <div className="flex flex-col items-center justify-center h-screen p-4 text-center gap-4">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <h1 className="text-2xl font-bold">Error en la generación</h1>
                <p className="text-muted-foreground max-w-sm">{errorMessage}</p>
                <Button onClick={() => navigate('/')}>Volver al Panel</Button>
            </div>
        );
    }

    const content = proposal.content || {};
    const heroColor = proposal?.documents?.agencies?.primary_color || '#000000';
    const heroTextColor = getContrastColor(heroColor);

    return (
        <div className="min-h-screen bg-neutral-50/50 flex">
            {/* Main Content */}
            <div className="flex-1 min-h-screen flex flex-col relative overflow-hidden">
                <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b px-4 lg:px-8 py-4">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/briefing/${proposal.document_id}`)}
                            className="gap-2"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Briefing
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setIsFullWidth(!isFullWidth)}
                            >
                                {isFullWidth ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                {isFullWidth ? 'Estándar' : 'Ancho'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={handleDownloadPDF}
                            >
                                <Download className="h-4 w-4" />
                                PDF
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setShowChat(!showChat)}
                                className={cn(
                                    "gap-2 transition-all",
                                    showChat ? "bg-primary text-white" : "bg-neutral-900 text-white"
                                )}
                            >
                                <MessageSquare className="h-4 w-4" />
                                Editar con IA
                            </Button>
                        </div>
                    </div>
                </header>

                <main className={cn(
                    "flex-1 p-4 lg:p-12 mt-8 transition-all duration-500 mx-auto w-full",
                    isFullWidth ? "max-w-7xl" : "max-w-4xl"
                )}>
                    <div
                        ref={proposalRef}
                        className="bg-white rounded-[3rem] shadow-2xl shadow-neutral-200/50 border border-neutral-100 overflow-hidden"
                    >
                        {/* Hero */}
                        <div
                            className="p-12 lg:p-24 text-center space-y-8 relative overflow-hidden transition-colors duration-700"
                            style={{ backgroundColor: heroColor }}
                        >
                            <div className="relative z-10 flex flex-col items-center gap-8">
                                {proposal?.documents?.agencies?.logo_url && (
                                    <img
                                        src={proposal.documents.agencies.logo_url}
                                        alt={proposal.documents.agencies.name}
                                        className="h-16 object-contain filter drop-shadow-xl"
                                    />
                                )}
                                <div
                                    className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border backdrop-blur-md"
                                    style={{
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        color: heroTextColor,
                                        borderColor: 'rgba(255,255,255,0.2)'
                                    }}
                                >
                                    Propuesta por {proposal?.documents?.agencies?.name}
                                </div>
                                <h1
                                    className="text-4xl lg:text-7xl font-black leading-[1] tracking-tight max-w-3xl"
                                    style={{ color: heroTextColor }}
                                >
                                    {content.headline}
                                </h1>
                            </div>
                        </div>

                        <div className="p-8 lg:p-16 space-y-16">
                            {/* Intro Section */}
                            <section className="max-w-2xl mx-auto text-center space-y-6">
                                <div className="w-12 h-1 bg-primary/30 mx-auto rounded-full" />
                                <p className="text-xl lg:text-3xl text-neutral-800 font-medium leading-relaxed italic">
                                    "{content.intro}"
                                </p>
                            </section>

                            {/* Image Section */}
                            {content.image_prompt && (
                                <section className="relative aspect-video rounded-[3rem] overflow-hidden shadow-2xl bg-neutral-100 group">
                                    <img
                                        src={`https://images.unsplash.com/photo-1523240715632-d984bc4b7969?auto=format&fit=crop&q=80&w=1200&keywords=${encodeURIComponent(content.image_prompt.split(',')[0])}`}
                                        alt="Context"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=1200";
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                                </section>
                            )}

                            {/* Solution */}
                            <section className="bg-neutral-50 rounded-[3rem] p-10 lg:p-16 border border-neutral-100 space-y-8">
                                <h2 className="text-3xl font-black text-neutral-900 flex items-center gap-4">
                                    <Sparkles className="h-8 w-8 text-primary" />
                                    Nuestra Visión
                                </h2>
                                <p className="text-xl text-neutral-800 leading-relaxed font-medium">
                                    {content.solution_presentation}
                                </p>
                            </section>

                            {/* Benefits */}
                            <section className="space-y-12">
                                <h3 className="text-xs font-black text-neutral-400 uppercase tracking-[0.3em] text-center">
                                    ¿Por qué nosotros?
                                </h3>
                                <div className="grid md:grid-cols-2 gap-6">
                                    {content.key_benefits?.map((benefit: string, i: number) => (
                                        <div key={i} className="flex gap-6 p-8 bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all group">
                                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:rotate-12 transition-transform">
                                                <CheckCircle2 className="h-6 w-6" />
                                            </div>
                                            <p className="text-lg font-bold text-neutral-900 leading-snug">
                                                {benefit}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* CTA */}
                            <section className="pt-12 text-center space-y-12">
                                <div className="p-12 lg:p-20 bg-neutral-900 rounded-[4rem] text-white space-y-8 shadow-2xl relative overflow-hidden">
                                    <div className="relative z-10 space-y-8">
                                        <h3 className="text-4xl lg:text-5xl font-black leading-tight max-w-2xl mx-auto">
                                            {content.call_to_action}
                                        </h3>
                                        <Button size="lg" className="bg-primary text-primary-foreground hover:scale-105 active:scale-95 font-black h-16 px-12 rounded-2xl text-xl shadow-2xl transition-all">
                                            ¡Empezar hoy!
                                        </Button>
                                    </div>
                                </div>

                                {content.visual_suggestions && (
                                    <div className="p-8 bg-white rounded-[2.5rem] border border-dashed border-neutral-200">
                                        <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                                            <Palette className="h-3 w-3" />
                                            Estilo Sugerido
                                        </p>
                                        <p className="text-sm text-neutral-500 italic font-medium">
                                            {content.visual_suggestions}
                                        </p>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </main>
            </div>

            {/* AI CHAT SIDEBAR */}
            {showChat && (
                <aside className="w-96 bg-white border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 z-40 h-screen sticky top-0">
                    <header className="p-6 border-b flex items-center justify-between bg-neutral-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <Bot className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm text-neutral-900 uppercase tracking-tight">Copiloto IA</h3>
                                <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">En línea</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setShowChat(false)} className="rounded-full">
                            <X className="h-4 w-4" />
                        </Button>
                    </header>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {chatMessages.length === 0 ? (
                            <div className="text-center py-12 space-y-4">
                                <Sparkles className="h-8 w-8 text-neutral-200 mx-auto" />
                                <p className="text-xs text-neutral-400 font-medium leading-relaxed px-4">
                                    Pídeme cualquier cambio: "hazlo más divertido", "enfócate más en los beneficios", o "cambia el tono".
                                </p>
                            </div>
                        ) : (
                            chatMessages.map((msg, i) => (
                                <div key={i} className={cn(
                                    "flex flex-col gap-2 max-w-[85%]",
                                    msg.role === 'user' ? "ml-auto items-end" : "items-start"
                                )}>
                                    <div className={cn(
                                        "px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed",
                                        msg.role === 'user' ? "bg-primary text-white" : "bg-neutral-100 text-neutral-800"
                                    )}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))
                        )}
                        {isChatting && (
                            <div className="flex items-center gap-2 text-neutral-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest">IA pensando...</span>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <footer className="p-6 border-t bg-neutral-50">
                        <div className="relative">
                            <Input
                                placeholder="Pide un cambio..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'ENTER' && handleSendMessage()}
                                className="pr-12 h-12 rounded-xl border-neutral-200 shadow-inner"
                            />
                            <Button
                                size="icon"
                                onClick={handleSendMessage}
                                disabled={!chatInput.trim() || isChatting}
                                className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </footer>
                </aside>
            )}
        </div>
    );
}
