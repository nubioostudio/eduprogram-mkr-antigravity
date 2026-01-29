import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    profile: any | null;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any | null>(null);

    useEffect(() => {
        let mounted = true;
        console.log('AuthContext: Mount');

        async function initAuth() {
            try {
                // 1. Get initial session
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    if (error.message?.includes('aborted')) {
                        console.log('AuthContext: Initial session fetch aborted (expected in some envs)');
                    } else {
                        throw error;
                    }
                }

                if (!mounted) return;

                console.log('AuthContext: Session state:', !!session);
                setSession(session);
                const currentUser = session?.user ?? null;
                setUser(currentUser);

                if (currentUser) {
                    await fetchProfile(currentUser.id);
                }
            } catch (err) {
                console.error('AuthContext: Critical Init Error:', err);
            } finally {
                if (mounted) {
                    setLoading(false);
                    console.log('AuthContext: Loading complete');
                }
            }
        }

        initAuth();

        // 2. Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('AuthContext: Auth Event:', event, !!session);
            if (!mounted) return;

            setSession(session);
            const currentUser = session?.user ?? null;
            setUser(currentUser);

            if (currentUser) {
                fetchProfile(currentUser.id);
            } else {
                setProfile(null);
            }

            setLoading(false);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId: string) => {
        console.log('AuthContext: Fetching profile for...', userId);
        try {
            // Simplify query: No joins to avoid PostgREST 406
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle();

            if (userError) {
                console.warn('AuthContext: User fetch error:', userError.message);
                return;
            }

            if (userData) {
                // Get agency separately
                const { data: agencyData, error: agencyError } = await supabase
                    .from('agencies')
                    .select('*')
                    .eq('id', userData.agency_id)
                    .maybeSingle();

                if (agencyError) {
                    console.warn('AuthContext: Agency fetch error:', agencyError.message);
                }

                setProfile({ ...userData, agencies: agencyData });
                console.log('AuthContext: Profile loaded for agency:', agencyData?.name);
            } else {
                console.log('AuthContext: No user record in public.users');
            }
        } catch (err) {
            console.log('AuthContext: Profile fetch exception (likely abort)', err);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, profile, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
