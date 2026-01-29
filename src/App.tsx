import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BriefingPage } from "@/components/features/BriefingPage";
import { DocumentViewerPage } from "@/components/features/DocumentViewerPage";
import { ProposalPage } from "@/components/features/ProposalPage";
import { Dashboard } from "@/components/features/Dashboard";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="flex items-center justify-center h-screen font-medium text-muted-foreground flex-col gap-2">
      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span>Cargando aplicación...</span>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
    } else if (!isSignUp) {
      navigate("/");
    } else {
      setError("Revisa tu email para confirmar la cuenta.");
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full bg-[#FDFDFF] lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center py-12 px-8">
        <div className="mx-auto grid w-[350px] gap-8">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Antigravity</h1>
            <p className="text-balance text-muted-foreground">
              {isSignUp ? "Crea una cuenta para tu agencia" : "Ingresa con tu correo de agencia"}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-bold uppercase tracking-widest text-neutral-400 text-[10px]">Email</label>
              <Input
                type="email"
                placeholder="m@agencia.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl border-neutral-100 bg-neutral-50/50"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-bold uppercase tracking-widest text-neutral-400 text-[10px]">Contraseña</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl border-neutral-100 bg-neutral-50/50"
              />
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <Button type="submit" className="h-12 w-full rounded-xl bg-neutral-900 font-bold" disabled={loading}>
              {loading ? "Accediendo..." : (isSignUp ? "Crear Cuenta" : "Entrar")}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-bold hover:underline">
              {isSignUp ? "¿Ya tienes cuenta? Entra aquí" : "¿No tienes cuenta? Regístrate"}
            </button>
          </div>
        </div>
      </div>
      <div className="hidden bg-neutral-900 lg:flex items-center justify-center p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[100px]" />
        </div>
        <div className="relative z-10 max-w-md space-y-4">
          <blockquote className="space-y-4">
            <p className="text-4xl font-black leading-tight tracking-tight">
              Diseñado para agencias que quieren <span className="text-primary">vender más</span> y trabajar menos.
            </p>
            <footer className="text-sm font-medium text-neutral-400 uppercase tracking-widest">— EduPrograms MKR</footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/briefing/:id" element={
            <ProtectedRoute>
              <BriefingPage />
            </ProtectedRoute>
          } />
          <Route path="/proposal/:id" element={
            <ProtectedRoute>
              <ProposalPage />
            </ProtectedRoute>
          } />
          <Route path="/viewer/:id" element={
            <ProtectedRoute>
              <DocumentViewerPage />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
