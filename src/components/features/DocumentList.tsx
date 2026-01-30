import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, AlertCircle, Loader2, ChevronRight, Trash2, AlertTriangle, CheckSquare, Square, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface Document {
    id: string;
    filename: string;
    storage_path: string;
    status: 'pending' | 'processing' | 'processed' | 'error';
    agency_id: string;
    created_at: string;
    briefing?: any;
    processing_error?: string;
    available_programs?: any[];
    proposals?: {
        id: string;
        status: 'processing' | 'ready' | 'error';
    }[];
}

export function DocumentList() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Deletion Modal State
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<Document | 'bulk' | null>(null);

    const fetchDocuments = async () => {
        if (!profile?.agency_id) return;

        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*, proposals(id, status)')
                .eq('agency_id', profile.agency_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDocuments(data || []);
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();

        const channel = supabase
            .channel('public:documents')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'documents',
                    filter: `agency_id=eq.${profile?.agency_id}`,
                },
                () => {
                    fetchDocuments();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.agency_id]);

    useEffect(() => {
        if (!profile?.agency_id) return;

        // Listen to proposal changes to update the counts in realtime
        const proposalChannel = supabase
            .channel('public:proposals_dashboard')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'proposals',
                },
                () => {
                    fetchDocuments();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(proposalChannel);
        };
    }, [profile?.agency_id]);

    const toggleSelect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === documents.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(documents.map(d => d.id));
        }
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);

        const idsToDelete = itemToDelete === 'bulk' ? selectedIds : [itemToDelete.id];
        const docsToDelete = documents.filter(d => idsToDelete.includes(d.id));

        try {
            // 1. Delete from Storage
            const paths = docsToDelete.map(d => d.storage_path);
            const { error: storageError } = await supabase.storage
                .from('documents')
                .remove(paths);

            if (storageError) console.error('Storage deletion error:', storageError);

            // 2. Delete from DB
            const { error: dbError } = await supabase
                .from('documents')
                .delete()
                .in('id', idsToDelete);

            if (dbError) throw dbError;

            // 3. Update State
            setDocuments(prev => prev.filter(d => !idsToDelete.includes(d.id)));
            setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)));
            setShowDeleteModal(false);
            setItemToDelete(null);
        } catch (error: any) {
            console.error('Delete error:', error);
            alert('Error al eliminar: ' + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (documents.length === 0) {
        return (
            <div className="text-center p-12 bg-muted/20 rounded-3xl border border-dashed">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No hay documentos procesados aún.</p>
                <p className="text-xs text-muted-foreground mt-1">Sube un PDF para comenzar tu primera propuesta.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-widest">Recientes</h3>
                    {documents.length > 0 && (
                        <button
                            onClick={toggleSelectAll}
                            className="text-[10px] font-bold text-primary hover:underline bg-primary/5 px-2 py-0.5 rounded"
                        >
                            {selectedIds.length === documents.length ? "Desmarcar todos" : "Seleccionar todos"}
                        </button>
                    )}
                </div>

                {selectedIds.length > 0 && (
                    <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 gap-2 rounded-lg animate-in fade-in zoom-in-95"
                        onClick={() => {
                            setItemToDelete('bulk');
                            setShowDeleteModal(true);
                        }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar ({selectedIds.length})
                    </Button>
                )}
            </div>

            <div className="grid gap-3">
                {documents.map((doc) => {
                    const isSelected = selectedIds.includes(doc.id);

                    return (
                        <div
                            key={doc.id}
                            className={cn(
                                "group relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer overflow-hidden",
                                isSelected ? "bg-primary/5 border-primary shadow-sm" : "bg-card border-border/50 hover:border-primary/30 hover:shadow-md"
                            )}
                            onClick={() => {
                                if (doc.status === 'processed' || doc.status === 'processing') {
                                    navigate(`/briefing/${doc.id}`);
                                }
                            }}
                        >
                            <div className="flex items-center gap-4 relative z-10">
                                {/* Checkbox Selector */}
                                <button
                                    onClick={(e) => toggleSelect(doc.id, e)}
                                    className={cn(
                                        "p-1.5 rounded-lg transition-colors",
                                        isSelected ? "text-primary bg-primary/10" : "text-muted-foreground/30 hover:text-primary group-hover:bg-neutral-100"
                                    )}
                                >
                                    {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                </button>

                                <div className={cn(
                                    "p-3.5 rounded-2xl shadow-lg transition-transform group-hover:scale-110 duration-500",
                                    doc.status === 'processed' ? "bg-neutral-900 text-white" :
                                        doc.status === 'error' ? "bg-red-500 text-white" :
                                            "bg-primary text-white"
                                )}>
                                    <FileText className="h-6 w-6" />
                                </div>

                                <div className="min-w-0">
                                    <h4 className="text-sm font-bold truncate max-w-[150px] md:max-w-xs text-neutral-800">
                                        {doc.filename}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                                            <Clock className="h-3 w-3" />
                                            {new Date(doc.created_at).toLocaleDateString('es-ES', {
                                                day: 'numeric',
                                                month: 'short',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                        <StatusBadge status={doc.status} />

                                        {doc.available_programs && doc.available_programs.length > 1 && (
                                            <div className="flex items-center gap-1 text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase tracking-[0.05em] border border-primary/20">
                                                <Layers className="h-3 w-3" />
                                                Catálogo ({doc.available_programs.length})
                                            </div>
                                        )}

                                        {doc.status === 'processed' && doc.proposals && doc.proposals.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-neutral-300" />
                                                <div className="flex items-center gap-1.5">
                                                    {doc.proposals.filter(p => p.status === 'ready').length > 0 && (
                                                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                                                            {doc.proposals.filter(p => p.status === 'ready').length} OK
                                                        </span>
                                                    )}
                                                    {doc.proposals.filter(p => p.status === 'processing').length > 0 && (
                                                        <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-md animate-pulse">
                                                            {doc.proposals.filter(p => p.status === 'processing').length} en curso
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 relative z-10">
                                {!isSelected && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setItemToDelete(doc);
                                            setShowDeleteModal(true);
                                        }}
                                        className="p-2 text-muted-foreground/20 hover:text-red-500 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                                <ChevronRight className="h-5 w-5 text-muted-foreground/20 group-hover:text-primary transition-colors" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-200 border border-neutral-100 text-center">
                        <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2">
                            <AlertTriangle className="h-8 w-8" />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-neutral-900">
                                {itemToDelete === 'bulk' ? `¿Eliminar ${selectedIds.length} documentos?` : '¿Eliminar documento?'}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {itemToDelete === 'bulk'
                                    ? "Se eliminarán permanentemente todos los archivos seleccionados y sus análisis. No se puede deshacer."
                                    : `Esta acción eliminará "${(itemToDelete as Document).filename}" permanentemente. No se puede deshacer.`
                                }
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                            <Button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                variant="destructive"
                                className="h-12 rounded-2xl font-bold text-base shadow-lg shadow-red-100"
                            >
                                {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar eliminación"}
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowDeleteModal(false);
                                    setItemToDelete(null);
                                }}
                                disabled={isDeleting}
                                variant="ghost"
                                className="h-12 rounded-2xl font-bold text-muted-foreground"
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: Document['status'] }) {
    switch (status) {
        case 'processed':
            return (
                <div className="flex items-center gap-2 text-[9px] font-black text-white bg-neutral-900 px-3 py-1 rounded-md uppercase tracking-[0.1em] shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Completo
                </div>
            );
        case 'error':
            return (
                <div className="flex items-center gap-2 text-[9px] font-black text-white bg-red-600 px-3 py-1 rounded-md uppercase tracking-[0.1em] shadow-sm">
                    <AlertCircle className="h-3 w-3" />
                    Error
                </div>
            );
        case 'processing':
            return (
                <div className="flex items-center gap-2 text-[9px] font-black text-white bg-primary px-3 py-1 rounded-md uppercase tracking-[0.1em] shadow-sm shadow-primary/20">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Procesando
                </div>
            );
        default:
            return (
                <div className="flex items-center gap-2 text-[9px] font-black text-neutral-400 bg-neutral-100 px-3 py-1 rounded-md uppercase tracking-[0.1em]">
                    <Clock className="h-3 w-3" />
                    En cola
                </div>
            );
    }
}
