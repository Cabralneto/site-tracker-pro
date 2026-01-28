import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge, DelayBadge } from '@/components/pt/StatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, Plus, Loader2, Calendar, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getTodayString, formatDateBR } from '@/lib/date-utils';

interface PT {
  id: string;
  numero_pt: string;
  tipo_pt: string;
  data_servico: string;
  status: string;
  responsavel_atraso: string | null;
  equipe: string | null;
  criado_em: string;
  frentes?: { id: string; nome: string } | null;
  disciplinas?: { id: string; nome: string } | null;
}

interface Frente {
  id: string;
  nome: string;
}

interface Disciplina {
  id: string;
  nome: string;
}

export default function PTList() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [pts, setPTs] = useState<PT[]>([]);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(getTodayString());
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [frenteFilter, setFrenteFilter] = useState('all');
  const [disciplinaFilter, setDisciplinaFilter] = useState('all');
  const [responsavelFilter, setResponsavelFilter] = useState(searchParams.get('responsavel') || 'all');

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    fetchPTs();
  }, [dateFilter, statusFilter, frenteFilter, disciplinaFilter, responsavelFilter]);

  async function fetchFiltersData() {
    const [frentesRes, disciplinasRes] = await Promise.all([
      supabase.from('frentes').select('id, nome').eq('ativo', true),
      supabase.from('disciplinas').select('id, nome').eq('ativo', true),
    ]);
    
    if (frentesRes.data) setFrentes(frentesRes.data);
    if (disciplinasRes.data) setDisciplinas(disciplinasRes.data);
  }

  async function fetchPTs() {
    setLoading(true);
    try {
      let query = supabase
        .from('pts')
        .select(`
          id,
          numero_pt,
          tipo_pt,
          data_servico,
          status,
          responsavel_atraso,
          equipe,
          criado_em,
          frentes (id, nome),
          disciplinas (id, nome)
        `)
        .eq('data_servico', dateFilter)
        .order('criado_em', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'pendente' | 'solicitada' | 'chegada' | 'liberada' | 'impedida');
      }

      if (frenteFilter !== 'all') {
        query = query.eq('frente_id', frenteFilter);
      }

      if (disciplinaFilter !== 'all') {
        query = query.eq('disciplina_id', disciplinaFilter);
      }

      if (responsavelFilter !== 'all') {
        query = query.eq('responsavel_atraso', responsavelFilter as 'etm' | 'petrobras' | 'sem_atraso' | 'impedimento');
      }

      const { data, error } = await query;

      if (error) throw error;
      setPTs(data as PT[]);
    } catch (error) {
      console.error('Error fetching PTs:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredPTs = pts.filter(pt => 
    pt.numero_pt.toLowerCase().includes(search.toLowerCase()) ||
    pt.equipe?.toLowerCase().includes(search.toLowerCase())
  );

  const clearFilters = () => {
    setStatusFilter('all');
    setFrenteFilter('all');
    setDisciplinaFilter('all');
    setResponsavelFilter('all');
    setSearchParams({});
  };

  const hasActiveFilters = statusFilter !== 'all' || frenteFilter !== 'all' || 
    disciplinaFilter !== 'all' || responsavelFilter !== 'all';

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Permissões de Trabalho</h1>
          <Button onClick={() => navigate('/nova-pt')} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>

        {/* Date selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="flex-1"
          />
        </div>

        {/* Search and filter toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número ou equipe..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button 
            variant={showFilters ? 'secondary' : 'outline'} 
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <Card className="animate-fade-in">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Filtros</span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="solicitada">Solicitada</SelectItem>
                    <SelectItem value="chegada">Chegada</SelectItem>
                    <SelectItem value="liberada">Liberada</SelectItem>
                    <SelectItem value="impedida">Impedida</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="etm">Atraso ETM</SelectItem>
                    <SelectItem value="petrobras">Atraso Petrobras</SelectItem>
                    <SelectItem value="sem_atraso">No prazo</SelectItem>
                    <SelectItem value="impedimento">Impedida</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={frenteFilter} onValueChange={setFrenteFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Frente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as frentes</SelectItem>
                    {frentes.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={disciplinaFilter} onValueChange={setDisciplinaFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as disciplinas</SelectItem>
                    {disciplinas.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active filters badges */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Status: {statusFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setStatusFilter('all')} />
              </Badge>
            )}
            {responsavelFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                Resp: {responsavelFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setResponsavelFilter('all')} />
              </Badge>
            )}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredPTs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhuma PT encontrada</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => navigate('/nova-pt')}
            >
              Criar nova PT
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {filteredPTs.length} PT{filteredPTs.length !== 1 ? 's' : ''} encontrada{filteredPTs.length !== 1 ? 's' : ''}
            </p>
            {filteredPTs.map((pt) => (
              <Card
                key={pt.id}
                className="card-interactive cursor-pointer"
                onClick={() => navigate(`/pt/${pt.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold">{pt.numero_pt}</span>
                        <Badge variant="outline" className="text-2xs uppercase">
                          {pt.tipo_pt}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {pt.frentes?.nome || 'Sem frente'} • {pt.disciplinas?.nome || 'Sem disciplina'}
                      </p>
                      {pt.equipe && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Equipe: {pt.equipe}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(pt.criado_em), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge status={pt.status} />
                      {/* DelayBadge só visível para Admin */}
                      {isAdmin && pt.responsavel_atraso && (
                        <DelayBadge responsavel={pt.responsavel_atraso} />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
