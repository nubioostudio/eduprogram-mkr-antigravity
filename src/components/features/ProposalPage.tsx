import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Wand2, Loader2, AlertCircle, Maximize, Minimize, MessageSquare, Bot, X, Send, Palette, Sparkles, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '@/lib/utils';
import { BlockRenderer } from './ProposalBlocks';
import type { ProposalTheme } from './ProposalBlocks';


export function ProposalPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [proposal, setProposal] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [messageIndex, setMessageIndex] = useState(0);
    const [isFullWidth, setIsFullWidth] = useState(true);
    const [showChat, setShowChat] = useState(false);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);
    const [selectedElement, setSelectedElement] = useState<{ blockId: string, elementPath: string, content: string } | null>(null);
    const [selectedBlock, setSelectedBlock] = useState<{ id: string, type: string } | null>(null);
    const [theme, setTheme] = useState<ProposalTheme>({
        fontScale: 1,
        spacingScale: 1,
        borderRadius: 'full',
        horizontalSpacing: 0,
        primaryColor: ''
    });
    const [showStyleEditor, setShowStyleEditor] = useState(false);
    const proposalRef = useRef<HTMLDivElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (showChat || selectedElement) {
            scrollToBottom();
        }
    }, [chatMessages, showChat, selectedElement]);

    const handleDownloadPDF = async () => {
        if (!proposalRef.current) return;
        try {
            const wasPreview = isPreviewMode;
            setIsPreviewMode(true);

            // Wait for render
            await new Promise(resolve => setTimeout(resolve, 500));

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pageHeightPx = 1120; // 96dpi A4 approx height in pixels

            // Create temporary container
            const container = document.createElement('div');
            container.style.width = '1200px';
            container.style.backgroundColor = '#ffffff';
            container.style.position = 'absolute';
            container.style.top = '-9999px';
            container.style.left = '-9999px';
            document.body.appendChild(container);

            const children = Array.from(proposalRef.current.children) as HTMLElement[];
            let currentHeight = 0;
            let pages: HTMLElement[][] = [[]];
            let currentPageIndex = 0;

            children.forEach((child) => {
                const hasPageBreak = child.querySelector('.page-break');
                const childHeight = child.offsetHeight;

                if (hasPageBreak) {
                    pages.push([]);
                    currentPageIndex++;
                    currentHeight = 0;
                } else {
                    if (currentHeight + childHeight > pageHeightPx && currentHeight > 100) {
                        pages.push([]);
                        currentPageIndex++;
                        currentHeight = 0;
                    }
                    pages[currentPageIndex].push(child);
                    currentHeight += childHeight;
                }
            });

            // Clean up empty pages
            pages = pages.filter(p => p.length > 0);

            for (let i = 0; i < pages.length; i++) {
                if (i > 0) pdf.addPage();

                container.innerHTML = '';
                pages[i].forEach(node => {
                    const clone = node.cloneNode(true) as HTMLElement;
                    const breaks = clone.querySelectorAll('.page-break');
                    breaks.forEach(b => b.remove());
                    container.appendChild(clone);
                });

                const canvas = await html2canvas(container, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    windowWidth: 1200
                });

                const imgData = canvas.toDataURL('image/png');
                const imgProps = pdf.getImageProperties(imgData);
                const imgHeightInPdf = (imgProps.height * pdfWidth) / imgProps.width;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeightInPdf);
            }

            document.body.removeChild(container);
            pdf.save(`Propuesta_${proposal.documents?.filename || 'EduTech'}.pdf`);

            if (!wasPreview) setIsPreviewMode(false);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar el PDF.');
        }
    };

    const fetchProposal = async () => {
        if (!id) return;
        const { data, error } = await supabase
            .from('proposals')
            .select('*, documents(filename, briefing, agency_id, agencies(name, logo_url, primary_color))')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching proposal:', error);
            setLoading(false);
        } else {
            setProposal(data);
            if (data.status !== 'processing') {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchProposal();

        const channel = supabase
            .channel(`proposal-${id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'proposals',
                filter: `id=eq.${id}`
            }, (payload) => {
                console.log('Realtime update received:', payload.new.status);
                setProposal((prev: any) => ({ ...prev, ...payload.new }));
                if (payload.new.status !== 'processing') {
                    setLoading(false);
                    if (payload.new.status === 'ready') {
                        fetchProposal();
                    }
                }
            })
            .subscribe();

        // Fallback: Check status manually every 10s if still processing
        const fallbackInterval = setInterval(() => {
            if (loading || (proposal && proposal.status === 'processing')) {
                console.log('Running fallback fetch...');
                fetchProposal();
            }
        }, 10000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(fallbackInterval);
        };
    }, [id]);

    useEffect(() => {
        if (!loading || !proposal || proposal.status !== 'processing') return;

        const messages = [
            'Creando una propuesta única...',
            'Poniendo todos los elementos a punto...',
            proposal.tone === 'Inspirador' ? 'Redactando con toque inspirador...' : 'Ajustando el tono de comunicación...',
            'Seleccionando las mejores imágenes...',
            'Finalizando detalles estructurales...'
        ];

        const messageInterval = setInterval(() => {
            setMessageIndex((prev) => (prev + 1) % messages.length);
        }, 3500);

        const progressInterval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 95) return prev;
                return prev + (Math.random() * 5);
            });
        }, 2000);

        return () => {
            clearInterval(messageInterval);
            clearInterval(progressInterval);
        };
    }, [loading, proposal]);

    const handleSendMessage = async (customInstruction?: string, isGranular: boolean = false) => {
        const instruction = typeof customInstruction === 'string' ? customInstruction : chatInput;
        if (!instruction.trim() || isChatting) return;

        const userMsg = instruction;
        const images = [...uploadedImages];

        if (!isGranular) {
            setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
            setChatInput('');
        }

        setUploadedImages([]);
        setIsChatting(true);

        try {
            const { data, error } = await supabase.functions.invoke('edit-proposal', {
                body: {
                    proposal_id: id,
                    instruction: userMsg,
                    images: images.length > 0 ? images : undefined,
                    target_element: isGranular ? {
                        block_id: selectedElement?.blockId,
                        path: selectedElement?.elementPath
                    } : undefined
                }
            });

            if (error) throw new Error(error.message || 'Error desconocido');
            if (data?.error) throw new Error(data.error);

            if (!isGranular) {
                setChatMessages(prev => [...prev, { role: 'ai', text: '¡Propuesta actualizada!' }]);
            } else {
                setSelectedElement(null);
                setChatInput('');
            }

            await fetchProposal();
        } catch (error: any) {
            console.error('Chat error:', error);
            const errorMsg = error.message || 'Error al aplicar cambios';
            if (!isGranular) {
                setChatMessages(prev => [...prev, { role: 'ai', text: `Error: ${errorMsg}` }]);
            } else {
                alert(`Error: ${errorMsg}`);
            }
        } finally {
            setIsChatting(false);
        }
    };

    const handleElementSelect = (blockId: string, elementPath: string, content: string) => {
        setSelectedElement({ blockId, elementPath, content });
    };

    if (loading || (proposal && proposal.status === 'processing')) {
        const messages = [
            'Creando una propuesta única...',
            'Poniendo todos los elementos a punto...',
            proposal?.tone === 'Inspirador' ? 'Redactando con toque inspirador...' : 'Ajustando el tono de comunicación...',
            'Seleccionando las mejores imágenes...',
            'Finalizando detalles estructurales...'
        ];

        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center space-y-12">
                <div className="relative">
                    <div className="h-40 w-40 rounded-full border-4 border-neutral-50 flex items-center justify-center">
                        <Wand2 className="h-16 w-16 text-primary animate-pulse" />
                    </div>
                    <div className="absolute inset-0 h-40 w-40 rounded-full border-[6px] border-primary border-t-transparent animate-spin" />
                </div>
                <div className="max-w-md w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    <div className="space-y-4">
                        <h2 className="text-4xl font-black text-neutral-900 leading-tight tracking-tighter">
                            {messages[messageIndex]}
                        </h2>
                        <p className="text-neutral-500 font-medium leading-relaxed">
                            Nuestro experto de IA está usando la Skill de Marketing Educativo para transformar el briefing en una propuesta persuasiva.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="h-3 w-full bg-neutral-100 rounded-full overflow-hidden p-1 shadow-inner">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-neutral-400">
                            <span className="flex items-center gap-2">
                                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                                MODO AIDA ACTIVO
                            </span>
                            <span className="text-primary">{Math.round(progress)}%</span>
                        </div>
                    </div>

                    <div className="pt-8 border-t border-neutral-50">
                        <Button
                            variant="ghost"
                            onClick={() => navigate('/')}
                            className="text-neutral-400 hover:text-neutral-900 font-black uppercase tracking-widest text-[10px] gap-2 transition-all hover:gap-4"
                        >
                            <ChevronLeft className="h-3 w-3" />
                            Cancelar y volver al Panel
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (proposal && proposal.status === 'error') {
        return (
            <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center text-red-600">
                    <AlertCircle className="h-10 w-10" />
                </div>
                <div className="space-y-2 max-w-sm">
                    <h2 className="text-2xl font-black text-neutral-900">Algo salió mal</h2>
                    <p className="text-neutral-500 font-medium">
                        No pudimos generar la propuesta en este momento. Por favor, inténtalo de nuevo.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setLoading(true);
                        supabase.functions.invoke('generate-proposal', { body: { proposal_id: id } });
                    }}
                    className="bg-neutral-900 hover:bg-neutral-800 text-white font-bold h-12 px-8 rounded-xl"
                >
                    Reintentar Generación
                </Button>
                <Button variant="ghost" onClick={() => navigate(-1)} className="text-neutral-500">
                    Volver al Briefing
                </Button>
            </div>
        );
    }

    const heroColor = proposal?.documents?.agencies?.primary_color || '#000000';

    return (
        <div className="min-h-screen bg-neutral-50/50 flex">
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
                                variant={showStyleEditor ? "default" : "outline"}
                                size="sm"
                                className={cn("gap-2", showStyleEditor && "bg-primary text-white border-primary")}
                                onClick={() => {
                                    setShowStyleEditor(!showStyleEditor);
                                    if (!showStyleEditor) setShowChat(false);
                                }}
                            >
                                <Palette className="h-4 w-4" />
                                Estilo
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setShowChat(!showChat);
                                    if (!showChat) setIsPreviewMode(false);
                                }}
                                className={cn(
                                    "gap-2 transition-all",
                                    showChat ? "bg-primary text-white" : "bg-neutral-900 text-white"
                                )}
                            >
                                <MessageSquare className="h-4 w-4" />
                                Editar con IA
                            </Button>
                            <Button
                                variant={isPreviewMode ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                    setIsPreviewMode(!isPreviewMode);
                                    if (!isPreviewMode) setShowChat(false);
                                }}
                                className={cn("gap-2", isPreviewMode && "bg-primary text-white border-primary")}
                            >
                                {isPreviewMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                {isPreviewMode ? 'Salir Preview' : 'Preview'}
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
                        {proposal.content?.sections?.map((section: any, index: number) => (
                            <div key={index}>
                                <BlockRenderer
                                    section={section}
                                    heroColor={heroColor}
                                    agencyLogo={proposal?.documents?.agencies?.logo_url}
                                    agencyName={proposal?.documents?.agencies?.name}
                                    isPreview={isPreviewMode}
                                    onElementSelect={handleElementSelect}
                                    selectedElement={selectedElement}
                                    theme={theme}
                                    onBlockSelect={(id, type) => {
                                        setSelectedBlock({ id, type });
                                        setSelectedElement(null);
                                        setShowChat(true);
                                    }}
                                    selectedBlockId={selectedBlock?.id}
                                />
                                {index < proposal.content.sections.length - 1 && (
                                    <div className="p-8 lg:p-16" />
                                )}
                            </div>
                        ))}

                        {proposal.content?.visual_suggestions && (
                            <div className="p-8 lg:p-16">
                                <div className="p-8 bg-white rounded-[2.5rem] border border-dashed border-neutral-200">
                                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                                        <Palette className="h-3 w-3" />
                                        Estilo Sugerido
                                    </p>
                                    <p className="text-sm text-neutral-500 italic font-medium">
                                        {proposal.content.visual_suggestions}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {(showChat || selectedElement || selectedBlock) && !isPreviewMode && (
                <aside className="w-96 bg-white border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 z-40 h-screen sticky top-0">
                    <header className="p-6 border-b flex items-center justify-between bg-neutral-50">
                        <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors", (selectedElement || selectedBlock) ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                                {(selectedElement || selectedBlock) ? <Sparkles className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
                            </div>
                            <div>
                                <h3 className="font-black text-sm text-neutral-900 uppercase tracking-tight">
                                    {selectedElement ? 'Editor Elemento' : selectedBlock ? 'Editor Sección' : 'Copiloto IA'}
                                </h3>
                                <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">En línea</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => {
                            setShowChat(false);
                            setSelectedElement(null);
                            setSelectedBlock(null);
                        }} className="rounded-full">
                            <X className="h-4 w-4" />
                        </Button>
                    </header>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {selectedElement ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Elemento Seleccionado</label>
                                    <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-sm italic text-neutral-600 leading-relaxed">
                                        "{selectedElement.content}"
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Acciones Rápidas</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Más persuasivo', 'Más conciso', 'Traducir al inglés', 'Corregir gramática', 'Hacerlo más profesional', 'Más emotivo'].map((sug) => (
                                            <button
                                                key={sug}
                                                onClick={() => handleSendMessage(sug, true)}
                                                className="text-[10px] font-bold px-3 py-2 bg-white hover:bg-primary hover:text-white transition-all rounded-xl border border-neutral-200 text-neutral-600 shadow-sm"
                                            >
                                                {sug}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : selectedBlock ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Sección Seleccionada</label>
                                    <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-sm italic text-neutral-600 leading-relaxed">
                                        Bloque: <span className="font-bold">#{selectedBlock.type}</span> ({selectedBlock.id})
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Acciones de Bloque</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['Cambiar tono general', 'Resumir sección', 'Expandir contenido', 'Traducir sección', 'Reorganizar puntos', 'Hacer más visual'].map((sug) => (
                                            <button
                                                key={sug}
                                                onClick={() => handleSendMessage(sug, true)} // TODO: Handle block context specifically
                                                className="text-[10px] font-bold px-3 py-2 bg-white hover:bg-primary hover:text-white transition-all rounded-xl border border-neutral-200 text-neutral-600 shadow-sm"
                                            >
                                                {sug}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>

                    <footer className="p-6 border-t bg-neutral-50 space-y-3">
                        {uploadedImages.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {uploadedImages.map((url, idx) => (
                                    <div key={idx} className="relative group">
                                        <img src={url} alt="Uploaded" className="h-16 w-16 object-cover rounded-lg border border-neutral-200" />
                                        <button
                                            onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== idx))}
                                            className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="relative flex gap-2">
                            {!selectedElement && !selectedBlock && (
                                <label className="cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={async (e) => {
                                            const files = Array.from(e.target.files || []);
                                            for (const file of files) {
                                                const fileName = `${Date.now()}_${file.name}`;
                                                const { data, error } = await supabase.storage
                                                    .from('proposal-images')
                                                    .upload(fileName, file);

                                                if (!error && data) {
                                                    const { data: { publicUrl } } = supabase.storage
                                                        .from('proposal-images')
                                                        .getPublicUrl(data.path);
                                                    setUploadedImages(prev => [...prev, publicUrl]);
                                                }
                                            }
                                            e.target.value = '';
                                        }}
                                    />
                                    <div className="p-3 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
                                        <Paperclip className="h-5 w-5 text-neutral-400" />
                                    </div>
                                </label>
                            )}
                            <Input
                                placeholder={selectedElement ? "Cambio para elemento..." : selectedBlock ? "Cambio para sección..." : "Pide un cambio global..."}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(chatInput, !!selectedElement)}
                                className="flex-1 h-12 rounded-xl border-neutral-200 shadow-inner"
                                autoFocus={!!selectedElement || !!selectedBlock}
                            />
                            <Button
                                size="icon"
                                onClick={() => handleSendMessage(chatInput, !!selectedElement)}
                                disabled={!chatInput.trim() || isChatting}
                                className="h-12 w-12 rounded-xl"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </div>
                    </footer>
                </aside>
            )}

            {showStyleEditor && (
                <aside className="w-80 bg-white border-l shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 z-40 h-screen sticky top-0">
                    <header className="p-6 border-b flex items-center justify-between bg-neutral-50">
                        <div className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-primary" />
                            <h3 className="font-black text-sm text-neutral-900 uppercase tracking-tight">Estilo Visual</h3>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setShowStyleEditor(false)} className="rounded-full">
                            <X className="h-4 w-4" />
                        </Button>
                    </header>
                    <div className="p-6 space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                                Color Principal
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl overflow-hidden shadow-sm border border-neutral-200 relative">
                                    <input
                                        type="color"
                                        value={theme.primaryColor || heroColor}
                                        onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value }))}
                                        className="absolute inset-0 w-[150%] h-[150%] -top-[25%] -left-[25%] cursor-pointer p-0 border-0"
                                    />
                                </div>
                                <div className="text-xs font-mono text-neutral-500 uppercase">
                                    {theme.primaryColor || heroColor}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex justify-between">
                                Tamaño de Texto
                                <span className="text-primary">{Math.round(theme.fontScale * 100)}%</span>
                            </label>
                            <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={theme.fontScale}
                                onChange={(e) => setTheme(prev => ({ ...prev, fontScale: parseFloat(e.target.value) }))}
                                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex justify-between">
                                Espaciado Vertical
                                <span className="text-primary">{Math.round(theme.spacingScale * 100)}%</span>
                            </label>
                            <input
                                type="range"
                                min="0.5"
                                max="3"
                                step="0.1"
                                value={theme.spacingScale}
                                onChange={(e) => setTheme(prev => ({ ...prev, spacingScale: parseFloat(e.target.value) }))}
                                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex justify-between">
                                Espaciado Horizontal
                                <span className="text-primary">+{theme.horizontalSpacing}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="6"
                                step="1"
                                value={theme.horizontalSpacing}
                                onChange={(e) => setTheme(prev => ({ ...prev, horizontalSpacing: parseFloat(e.target.value) }))}
                                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">
                                Estilo de Bordes
                            </label>
                            <div className="flex gap-2">
                                {[
                                    { value: 'none', label: 'Cuadrado' },
                                    { value: 'md', label: 'Suave' },
                                    { value: 'full', label: 'Redondo' }
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setTheme(prev => ({ ...prev, borderRadius: opt.value as any }))}
                                        className={cn(
                                            "px-4 py-2 text-xs font-bold rounded-lg border transition-all flex-1",
                                            theme.borderRadius === opt.value
                                                ? "bg-primary text-white border-primary"
                                                : "bg-white text-neutral-600 border-neutral-200 hover:border-primary/30"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>
            )}

        </div>
    );
}
