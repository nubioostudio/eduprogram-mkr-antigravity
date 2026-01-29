import { X, FileText, Target, ListChecks, Layers, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Document } from './DocumentList';

interface BriefingDetailProps {
    document: Document;
    onClose: () => void;
}

export function BriefingDetail({ document, onClose }: BriefingDetailProps) {
    const briefing = document.briefing;

    if (!briefing) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl animate-in zoom-in-95 duration-200">
                <header className="sticky top-0 bg-card/80 backdrop-blur-md p-6 border-b flex justify-between items-center z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl font-bold">Briefing de IA</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                </header>

                <div className="p-8 space-y-8">
                    {/* Title and Metadata */}
                    <div>
                        <h1 className="text-2xl font-extrabold text-primary mb-2 leading-tight">
                            {briefing.title}
                        </h1>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 w-fit px-3 py-1 rounded-full border">
                            <FileText className="h-4 w-4" />
                            <span>{document.filename}</span>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Target Audience */}
                        <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                                <Target className="h-4 w-4" />
                                Público Objetivo
                            </div>
                            <p className="text-sm leading-relaxed text-blue-900/80">
                                {briefing.target_audience}
                            </p>
                        </div>

                        {/* Duration */}
                        <div className="space-y-3 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                            <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                                <Clock className="h-4 w-4" />
                                Duración
                            </div>
                            <p className="text-sm leading-relaxed text-amber-900/80">
                                {briefing.duration || "No especificada"}
                            </p>
                        </div>
                    </div>

                    {/* Objectives */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary font-bold">
                            <ListChecks className="h-5 w-5" />
                            Objetivos Principales
                        </div>
                        <ul className="space-y-2">
                            {briefing.objectives?.map((obj: string, i: number) => (
                                <li key={i} className="flex gap-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-all">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">
                                        {i + 1}
                                    </span>
                                    {obj}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Modules */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary font-bold">
                            <Layers className="h-5 w-5" />
                            Módulos del Programa
                        </div>
                        <div className="grid gap-3">
                            {briefing.modules?.map((mod: any, i: number) => (
                                <div key={i} className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow group">
                                    <h4 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">
                                        {mod.name}
                                    </h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {mod.summary}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Highlights */}
                    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 border-dashed">
                        <div className="flex items-center gap-2 text-primary font-bold mb-4">
                            <Sparkles className="h-5 w-5" />
                            Puntos Clave Exclusivos
                        </div>
                        <div className="grid gap-2">
                            {briefing.key_highlights?.map((hl: string, i: number) => (
                                <div key={i} className="flex items-start gap-2 text-sm text-primary/80">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                    {hl}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <footer className="p-6 border-t bg-muted/20 flex justify-end">
                    <Button onClick={onClose} variant="secondary">Cerrar</Button>
                </footer>
            </div>
        </div>
    );
}
