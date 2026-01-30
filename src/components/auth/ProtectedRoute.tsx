import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin } = useAuth();
  const [checkingPasswordChange, setCheckingPasswordChange] = useState(true);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);

  useEffect(() => {
    async function checkPasswordChange() {
      if (!user) {
        setCheckingPasswordChange(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('force_password_change')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.force_password_change === true) {
          setNeedsPasswordChange(true);
        }
      } catch (error) {
        console.error('Error checking password change:', error);
      } finally {
        setCheckingPasswordChange(false);
      }
    }

    if (!loading && user) {
      checkPasswordChange();
    } else if (!loading) {
      setCheckingPasswordChange(false);
    }
  }, [user, loading]);

  if (loading || checkingPasswordChange) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (needsPasswordChange) {
    return <Navigate to="/definir-senha" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
