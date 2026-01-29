import { Button } from "@/components/ui/button";
import { UploadDropzone } from "@/components/features/UploadDropzone";
import { DocumentList } from "@/components/features/DocumentList";
import { StatsOverview } from "@/components/features/StatsOverview";
import { AgencySettings } from "@/components/features/AgencySettings";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, LayoutDashboard, Settings, User, Bell, Sparkles } from 'lucide-react';
import { useState } from 'react';

export function Dashboard() {
    const { profile, signOut } = useAuth();
    const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');

    return (
        <div className="min-h-screen bg-[#FDFDFF]">
            {/* Sidebar / Nav */}
            <aside className="fixed left-0 top-0 h-full w-20 lg:w-64 bg-white border-r border-neutral-100 z-40 hidden md:flex flex-col">
                <div className="p-8">
                    <div className="w-10 h-10 bg-neutral-900 rounded-2xl flex items-center justify-center text-white font-black">
                        A
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <Button
                        variant="ghost"
                        onClick={() => setView('dashboard')}
                        className={`w-full justify-start gap-3 rounded-xl px-4 py-6 font-bold transition-all ${view === 'dashboard' ? 'bg-neutral-50 text-neutral-900' : 'text-neutral-400 hover:text-neutral-900'}`}
                    >
                        <LayoutDashboard className="h-5 w-5" />
                        <span className="hidden lg:inline">Panel</span>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-neutral-400 hover:text-neutral-900 rounded-xl px-4 py-6 font-medium">
                        <User className="h-5 w-5" />
                        <span className="hidden lg:inline">Perfil</span>
                    </Button>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-neutral-400 hover:text-neutral-900 rounded-xl px-4 py-6 font-medium">
                        <Bell className="h-5 w-5" />
                        <span className="hidden lg:inline">Notificaciones</span>
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => setView('settings')}
                        className={`w-full justify-start gap-3 rounded-xl px-4 py-6 font-bold transition-all ${view === 'settings' ? 'bg-neutral-50 text-neutral-900' : 'text-neutral-400 hover:text-neutral-900'}`}
                    >
                        <Settings className="h-5 w-5" />
                        <span className="hidden lg:inline">Ajustes</span>
                    </Button>
                </nav>

                <div className="p-4 border-t border-neutral-100">
                    <Button
                        variant="ghost"
                        onClick={() => signOut()}
                        className="w-full justify-start gap-3 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-xl px-4 py-6 font-medium"
                    >
                        <LogOut className="h-5 w-5" />
                        <span className="hidden lg:inline">Cerrar Sesión</span>
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="md:pl-20 lg:pl-64 min-h-screen flex flex-col">
                {/* Header */}
                <header className="h-20 bg-white/80 backdrop-blur-md border-b border-neutral-100 px-8 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center gap-2">
                        <div className="px-2 py-0.5 bg-neutral-900 text-white text-[10px] font-black uppercase rounded-md">Pro</div>
                        <h1 className="text-sm font-black text-neutral-900 tracking-tighter">EduTechIA Workspace</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex flex-col items-end">
                            <span className="text-[11px] font-bold text-neutral-900">{profile?.email}</span>
                            <span className="px-2 py-0.5 bg-neutral-900 text-white text-[9px] font-black uppercase tracking-widest rounded-md mt-1 shadow-sm">Plan Agencia</span>
                        </div>
                        <div className="h-8 w-8 rounded-lg bg-neutral-100 border border-neutral-200 flex items-center justify-center overflow-hidden">
                            <User className="h-4 w-4 text-neutral-400" />
                        </div>
                    </div>
                </header>

                <div className="p-8 max-w-[1400px] mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {view === 'dashboard' ? (
                        <>
                            {/* Welcome Banner + Quick Upload */}
                            <div className="relative p-8 lg:p-12 bg-neutral-900 rounded-[3rem] overflow-hidden text-white shadow-2xl flex flex-col lg:flex-row items-center gap-12 group">
                                {/* Background effects */}
                                <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />
                                <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-blue-500/10 rounded-full blur-[80px]" />

                                <div className="flex-1 space-y-4 relative z-10 text-center lg:text-left">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-white rounded-full text-[10px] font-black uppercase tracking-tight shadow-xl shadow-primary/20 border border-white/20">
                                        <Sparkles className="h-3 w-3" />
                                        Nueva Propuesta
                                    </div>
                                    <h2 className="text-4xl lg:text-5xl font-black tracking-tighter leading-none text-white animate-in slide-in-from-left-4 duration-700">¡Hola de nuevo! ✨</h2>
                                    <p className="text-neutral-400 text-base max-w-md lg:mx-0 mx-auto font-medium">
                                        Sube el PDF del programa educativo aquí mismo para empezar el análisis.
                                    </p>
                                </div>

                                {/* Integrated Compact Upload Area */}
                                <div className="w-full lg:w-[320px] relative z-10 animate-in zoom-in-95 duration-700 delay-200">
                                    <UploadDropzone variant="minimal" />
                                </div>
                            </div>

                            {/* Main Content Grid */}
                            <div className="grid lg:grid-cols-12 gap-8 items-start pb-20">
                                {/* Left: Documents (6/12) */}
                                <div className="lg:col-span-6 space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-xs font-black text-neutral-900 uppercase tracking-tighter">Programas Recientes</h3>
                                    </div>
                                    <DocumentList />
                                </div>

                                {/* Right: Stats & Tips (6/12) */}
                                <div className="lg:col-span-6 space-y-8">
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black text-neutral-900 uppercase tracking-tighter px-2">Rendimiento</h3>
                                        <StatsOverview />
                                    </div>

                                    {/* Tips card */}
                                    <div className="p-8 bg-neutral-900 rounded-[2.5rem] text-white space-y-8 shadow-2xl border border-white/5 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:rotate-12 transition-transform">
                                            <Bell className="h-12 w-12 text-primary" />
                                        </div>
                                        <div className="space-y-3 relative z-10">
                                            <h4 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Tip de Hoy</h4>
                                            <p className="text-lg text-white/90 leading-relaxed font-bold">
                                                Nuestra IA ahora usa el método <span className="bg-white text-neutral-900 px-2 py-0.5 rounded-md shadow-lg shadow-white/5 mx-1">AIDA</span> para maximizar la conversión en tus propuestas.
                                            </p>
                                        </div>
                                        <div className="flex justify-start">
                                            <Button variant="secondary" size="sm" className="bg-white text-neutral-900 hover:bg-neutral-50 h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl w-auto">
                                                Ver todas las tácticas
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <AgencySettings />
                    )}
                </div>
            </main>
        </div>
    );
}
