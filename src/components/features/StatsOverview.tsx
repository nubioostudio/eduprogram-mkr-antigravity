import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Wand2, AlertCircle } from 'lucide-react';

export function StatsOverview() {
    const { profile } = useAuth();
    const [stats, setStats] = useState({
        docs: 0,
        proposals: 0,
        errors: 0
    });

    useEffect(() => {
        async function fetchStats() {
            if (!profile?.agency_id) return;

            const [docsRes, propRes] = await Promise.all([
                supabase.from('documents').select('status', { count: 'exact' }).eq('agency_id', profile.agency_id),
                supabase.from('proposals').select('status', { count: 'exact' }).eq('agency_id', profile.agency_id)
            ]);

            setStats({
                docs: docsRes.count || 0,
                proposals: propRes.count || 0,
                errors: (docsRes.data?.filter(d => d.status === 'error').length || 0) + (propRes.data?.filter(p => p.status === 'error').length || 0)
            });
        }

        fetchStats();
    }, [profile?.agency_id]);

    return (
        <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-5 rounded-[2rem] border border-neutral-100 shadow-sm space-y-2 flex flex-col items-start text-left group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-1.5 text-[9px] font-black text-neutral-900 uppercase tracking-tight">
                    <div className="p-1 bg-neutral-50 rounded-lg group-hover:bg-primary/10 transition-colors">
                        <FileText className="h-3 w-3 text-neutral-900 group-hover:text-primary transition-colors" />
                    </div>
                    Documentos
                </div>
                <p className="text-4xl font-black text-neutral-900 leading-none">{stats.docs}</p>
            </div>

            <div className="bg-white p-5 rounded-[2rem] border border-neutral-100 shadow-sm space-y-2 flex flex-col items-start text-left group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-1.5 text-[9px] font-black text-neutral-900 uppercase tracking-tight">
                    <div className="p-1 bg-neutral-50 rounded-lg group-hover:bg-primary/10 transition-colors">
                        <Wand2 className="h-3 w-3 text-neutral-900 group-hover:text-primary transition-colors" />
                    </div>
                    Propuestas
                </div>
                <p className="text-4xl font-black text-neutral-900 leading-none">{stats.proposals}</p>
            </div>

            <div className="bg-white p-5 rounded-[2rem] border border-neutral-100 shadow-sm space-y-2 flex flex-col items-start text-left group hover:border-red-500/20 transition-all">
                <div className="flex items-center gap-1.5 text-[9px] font-black text-neutral-900 uppercase tracking-tight">
                    <div className="p-1 bg-red-50 rounded-lg">
                        <AlertCircle className="h-3 w-3 text-red-600" />
                    </div>
                    Errores
                </div>
                <p className="text-4xl font-black text-neutral-900 leading-none">{stats.errors}</p>
            </div>
        </div>
    );
}
