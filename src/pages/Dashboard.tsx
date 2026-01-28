import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, DelayBadge } from '@/components/pt/StatusBadge';
import { 
  ClipboardList, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Plus,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getTodayString } from '@/lib/date-utils';

interface PTSummary {
  total: number;
  pendentes: number;
  solicitadas: number;
  chegada: number;
  liberadas: number;
  impedidas: number;
  atrasosETM: number;
  atrasosPetrobras: number;
}

interface RecentPT {
  id: string;
  numero_pt: string;
  tipo_pt: string;
  status: string;
  responsavel_atraso: string | null;
  criado_em: string;
  frentes?: { nome: string } | null;
  disciplinas?: { nome: string } | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, roles } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PTSummary>({
    total: 0,
    pendentes: 0,
    solicitadas: 0,
    chegada: 0,
    liberadas: 0,
    impedidas: 0,
    atrasosETM: 0,
    atrasosPetrobras: 0,
  });
  const [recentPTs, setRecentPTs] = useState<RecentPT[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const today = getTodayString();
      
      // Fetch today's PTs with related data
      const { data: pts, error } = await supabase
        .from('pts')
        .select(`
          id,
          numero_pt,
          tipo_pt,
          status,
          responsavel_atraso,
          criado_em,
          frentes (nome),
          disciplinas (nome)
        `)
        .eq('data_servico', today)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      if (pts) {
        // Calculate stats
        const summary: PTSummary = {
          total: pts.length,
          pendentes: pts.filter(p => p.status === 'pendente').length,
          solicitadas: pts.filter(p => p.status === 'solicitada').length,
          chegada: pts.filter(p => p.status === 'chegada').length,
          liberadas: pts.filter(p => p.status === 'liberada').length,
          impedidas: pts.filter(p => p.status === 'impedida').length,
          atrasosETM: pts.filter(p => p.responsavel_atraso === 'etm').length,
          atrasosPetrobras: pts.filter(p => p.responsavel_atraso === 'petrobras').length,
        };
        setStats(summary);
        setRecentPTs(pts.slice(0, 5) as RecentPT[]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getRoleLabel = () => {
    if (roles.includes('admin')) return 'Administrador';
    if (roles.includes('encarregado')) return 'Encarregado';
    if (roles.includes('operador')) return 'Operador';
    if (roles.includes('visualizador')) return 'Visualizador';
    return 'Usuário';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Welcome section */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">{getGreeting()}, {profile?.nome?.split(' ')[0] || 'Usuário'}!</h2>
          <p className="text-muted-foreground">{getRoleLabel()} • {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        </div>

        {/* Quick action */}
        <Button 
          onClick={() => navigate('/nova-pt')}
          className="w-full h-14 text-lg font-semibold gradient-primary"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nova PT
        </Button>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatsCard
            title="PTs Hoje"
            value={stats.total}
            icon={<ClipboardList className="h-5 w-5" />}
            variant="primary"
            onClick={() => navigate('/pts')}
          />
          <StatsCard
            title="Pendentes"
            value={stats.pendentes + stats.solicitadas}
            icon={<Clock className="h-5 w-5" />}
            variant="default"
            onClick={() => navigate('/pts?status=pendente')}
          />
          <StatsCard
            title="Atraso ETM"
            value={stats.atrasosETM}
            icon={<AlertTriangle className="h-5 w-5" />}
            variant="warning"
            onClick={() => navigate('/pts?responsavel=etm')}
          />
          <StatsCard
            title="Atraso Petrobras"
            value={stats.atrasosPetrobras}
            icon={<AlertTriangle className="h-5 w-5" />}
            variant="danger"
            onClick={() => navigate('/pts?responsavel=petrobras')}
          />
          <StatsCard
            title="Liberadas"
            value={stats.liberadas}
            icon={<CheckCircle2 className="h-5 w-5" />}
            variant="success"
            onClick={() => navigate('/pts?status=liberada')}
          />
          <StatsCard
            title="Impedidas"
            value={stats.impedidas}
            icon={<XCircle className="h-5 w-5" />}
            variant="default"
            onClick={() => navigate('/pts?status=impedida')}
          />
        </div>

        {/* Recent PTs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">PTs Recentes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/pts')}>
                Ver todas
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentPTs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma PT cadastrada hoje</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate('/nova-pt')}
                >
                  Criar primeira PT
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPTs.map((pt) => (
                  <div
                    key={pt.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/pt/${pt.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{pt.numero_pt}</span>
                        <span className="text-xs text-muted-foreground uppercase">{pt.tipo_pt}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {pt.frentes?.nome || 'Sem frente'} • {pt.disciplinas?.nome || 'Sem disciplina'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={pt.status} />
                      {pt.responsavel_atraso && (
                        <DelayBadge responsavel={pt.responsavel_atraso} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
