import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, ClipboardCheck, Eye, EyeOff, Check, X } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';

const passwordSchema = z.object({
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="h-4 w-4 text-primary" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={met ? 'text-primary' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  );
}

export default function SetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userName, setUserName] = useState<string>('');

  // Password strength indicators
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    // Check if user came from invite link
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          // No session - might need to handle the invite token from hash
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const type = hashParams.get('type');
          
          // Accept various invite-related types: invite, signup, recovery, magiclink
          const isInviteFlow = accessToken && refreshToken && 
            (type === 'invite' || type === 'signup' || type === 'recovery' || type === 'magiclink');
          
          if (isInviteFlow) {
            // Set the session from the invite link
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.error('Error setting session:', error);
              setError('Link de convite inválido ou expirado. Solicite um novo ao administrador.');
              setInitializing(false);
              return;
            }
            
            if (data.user) {
              // Check if this user needs to set password
              const { data: profile } = await supabase
                .from('profiles')
                .select('nome, force_password_change')
                .eq('id', data.user.id)
                .maybeSingle();
              
              if (!profile?.force_password_change) {
                // Password already set, redirect to home
                navigate('/');
                return;
              }
              
              setUserName(profile?.nome || data.user.user_metadata?.nome || data.user.email || '');
            }
          } else {
            // No invite token, redirect to auth
            navigate('/auth');
            return;
          }
        } else {
          // Already has session, check if needs password change
          const { data: profile } = await supabase
            .from('profiles')
            .select('nome, force_password_change')
            .eq('id', session.user.id)
            .maybeSingle();
          
          if (!profile?.force_password_change) {
            // Password already set, redirect to home
            navigate('/');
            return;
          }
          
          setUserName(profile?.nome || session.user.email || '');
        }
      } catch (err) {
        console.error('Error checking session:', err);
        setError('Erro ao verificar sessão');
      } finally {
        setInitializing(false);
      }
    };

    checkSession();
  }, [navigate]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const validation = passwordSchema.safeParse({ password, confirmPassword });
      if (!validation.success) {
        setError(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        setError('Erro ao definir senha. Tente novamente.');
        setLoading(false);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Update profile to mark password as set
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ force_password_change: false })
          .eq('id', user.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
          // Don't block - password is set, profile update is secondary
        }
      }

      toast.success('Senha definida com sucesso!');
      navigate('/');
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background safe-top safe-bottom">
      {/* Header */}
      <div className="gradient-dark text-primary-foreground py-8 px-4">
        <div className="max-w-md mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4">
            <ClipboardCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">PT Control</h1>
          <p className="text-primary-foreground/80 mt-1">Defina sua senha de acesso</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-start justify-center px-4 py-6 -mt-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Bem-vindo{userName ? `, ${userName}` : ''}!</CardTitle>
            <CardDescription>
              Crie uma senha segura para acessar o sistema
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password requirements */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground mb-2">Requisitos da senha:</p>
                <div className="space-y-1 text-sm">
                  <PasswordRequirement met={hasMinLength} label="Mínimo 8 caracteres" />
                  <PasswordRequirement met={hasUpperCase} label="Uma letra maiúscula" />
                  <PasswordRequirement met={hasLowerCase} label="Uma letra minúscula" />
                  <PasswordRequirement met={hasNumber} label="Um número" />
                  <PasswordRequirement met={passwordsMatch} label="Senhas coincidem" />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold" 
                disabled={loading || !hasMinLength || !passwordsMatch}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Definir Senha e Entrar'}
              </Button>
            </form>
          </CardContent>

          <div className="px-6 pb-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <Shield className="h-3 w-3" />
              <span>Sua senha é criptografada e segura</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
