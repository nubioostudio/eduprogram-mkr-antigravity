import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Image as ImageIcon, Palette, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function AgencySettings() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        logo_url: '',
        primary_color: '#000000'
    });

    useEffect(() => {
        if (profile?.agencies) {
            setFormData({
                name: profile.agencies.name || '',
                logo_url: profile.agencies.logo_url || '',
                primary_color: profile.agencies.primary_color || '#000000'
            });
        }
    }, [profile]);

    const handleSave = async () => {
        if (!profile?.agency_id) return;

        setLoading(true);
        setSuccess(false);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('agencies')
                .update({
                    logo_url: formData.logo_url,
                    primary_color: formData.primary_color
                })
                .eq('id', profile.agency_id);

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);

            // Note: In a real app we might want to refresh the profile in AuthContext
            // but for now the user will see it on next load or manual refresh.
        } catch (err: any) {
            console.error('Error saving settings:', err);
            setError(err.message || 'Error al guardar los ajustes');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
                <h2 className="text-2xl font-black text-neutral-900 tracking-tight">Ajustes de Agencia</h2>
                <p className="text-neutral-500 font-medium">Personaliza la identidad visual de tus propuestas.</p>
            </div>

            <div className="bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-sm space-y-8">
                {/* Logo Section */}
                <div className="space-y-4">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        <ImageIcon className="h-3 w-3" />
                        URL del Logo
                    </label>
                    <div className="flex gap-4 items-start">
                        <div className="flex-1">
                            <Input
                                placeholder="https://tu-bucket.com/logo.png"
                                value={formData.logo_url}
                                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                                className="h-12 rounded-xl border-neutral-100 bg-neutral-50/50"
                            />
                            <p className="mt-2 text-[11px] text-neutral-400 font-medium">
                                Recomendamos un archivo PNG transparente de unos 200px de ancho.
                            </p>
                        </div>
                        <div className="w-16 h-16 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {formData.logo_url ? (
                                <img src={formData.logo_url} alt="Preview" className="w-full h-full object-contain p-2" />
                            ) : (
                                <ImageIcon className="h-6 w-6 text-neutral-200" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Color Section */}
                <div className="space-y-4">
                    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                        <Palette className="h-3 w-3" />
                        Color Primario
                    </label>
                    <div className="flex gap-4 items-center">
                        <input
                            type="color"
                            value={formData.primary_color}
                            onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                            className="h-12 w-24 rounded-xl border-neutral-100 bg-neutral-50/50 cursor-pointer overflow-hidden p-1"
                        />
                        <Input
                            value={formData.primary_color}
                            onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                            className="flex-1 h-12 rounded-xl border-neutral-100 bg-neutral-50/50 uppercase"
                        />
                    </div>
                </div>

                {/* Status Messages */}
                {success && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-2xl animate-in zoom-in-95">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-bold">Ajustes guardados correctamente</span>
                    </div>
                )}
                {error && (
                    <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-2xl animate-in zoom-in-95">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-sm font-bold">{error}</span>
                    </div>
                )}

                <div className="pt-4">
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full h-14 rounded-2xl bg-neutral-900 text-white font-black uppercase tracking-widest hover:bg-neutral-800 shadow-xl shadow-neutral-900/10 transition-all gap-2"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                </div>
            </div>

            {/* Preview Card */}
            <div className="space-y-4">
                <h3 className="text-xs font-black text-neutral-900 uppercase tracking-tighter px-2">Vista Previa de Marca</h3>
                <div
                    className="p-12 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-4 shadow-lg transition-colors duration-500"
                    style={{ backgroundColor: formData.primary_color }}
                >
                    {formData.logo_url && (
                        <img src={formData.logo_url} alt="Logo Preview" className="h-10 object-contain mb-2 filter drop-shadow-lg" />
                    )}
                    <h4 className="text-2xl font-black text-white leading-tight">Titular de tu Propuesta</h4>
                    <div className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20 bg-white/10 text-white">
                        Propuesta por {formData.name}
                    </div>
                </div>
            </div>
        </div>
    );
}
