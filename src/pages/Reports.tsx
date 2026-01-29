import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge, DelayBadge } from '@/components/pt/StatusBadge';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Loader2, 
  Filter,
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface EventoInfo {
  tipo_evento: string;
  criado_em: string;
}

interface PTReport {
  id: string;
  numero_pt: string;
  tipo_pt: string;
  data_servico: string;
  status: 'pendente' | 'solicitada' | 'chegada' | 'liberada' | 'impedida';
  responsavel_atraso: 'etm' | 'petrobras' | 'sem_atraso' | 'impedimento' | null;
  equipe: string | null;
  criado_em: string;
  efetivo_qtd: number;
  encarregado_nome: string | null;
  encarregado_matricula: string | null;
  descricao_operacao: string | null;
  causa_atraso: string | null;
  atraso_etm: number;
  atraso_petrobras: number;
  frente_ids: string[];
  disciplina_ids: string[];
  frentes: { nome: string } | null;
  disciplinas: { nome: string } | null;
  hora_solicitacao?: string | null;
  hora_chegada?: string | null;
  hora_liberacao?: string | null;
  hh_improdutivo?: number;
  frentesNomes?: string[];
  disciplinasNomes?: string[];
}

interface Frente {
  id: string;
  nome: string;
}

interface Disciplina {
  id: string;
  nome: string;
}

interface ReportStats {
  total: number;
  liberadas: number;
  impedidas: number;
  atrasosETM: number;
  atrasosPetrobras: number;
  tempoMedioLiberacao: string;
  totalHHImprodutivo: number;
}

export default function Reports() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [pts, setPTs] = useState<PTReport[]>([]);
  const [stats, setStats] = useState<ReportStats>({
    total: 0,
    liberadas: 0,
    impedidas: 0,
    atrasosETM: 0,
    atrasosPetrobras: 0,
    tempoMedioLiberacao: '-',
    totalHHImprodutivo: 0,
  });
  
  // Filters
  const [dataInicio, setDataInicio] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return format(date, 'yyyy-MM-dd');
  });
  const [dataFim, setDataFim] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState('all');
  const [responsavelFilter, setResponsavelFilter] = useState('all');
  const [frenteFilter, setFrenteFilter] = useState('all');
  const [disciplinaFilter, setDisciplinaFilter] = useState('all');
  
  // Options
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [dataInicio, dataFim, statusFilter, responsavelFilter, frenteFilter, disciplinaFilter]);

  async function fetchFilterOptions() {
    const [frentesRes, disciplinasRes] = await Promise.all([
      supabase.from('frentes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('disciplinas').select('id, nome').eq('ativo', true).order('nome'),
    ]);

    if (frentesRes.data) setFrentes(frentesRes.data);
    if (disciplinasRes.data) setDisciplinas(disciplinasRes.data);
  }

  async function fetchReportData() {
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
          tempo_ate_liberacao,
          efetivo_qtd,
          encarregado_nome,
          encarregado_matricula,
          descricao_operacao,
          causa_atraso,
          atraso_etm,
          atraso_petrobras,
          frente_id,
          disciplina_id,
          frente_ids,
          disciplina_ids,
          frentes (nome),
          disciplinas (nome)
        `)
        .gte('data_servico', dataInicio)
        .lte('data_servico', dataFim)
        .order('data_servico', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as 'pendente' | 'solicitada' | 'chegada' | 'liberada' | 'impedida');
      }
      if (responsavelFilter !== 'all') {
        query = query.eq('responsavel_atraso', responsavelFilter as 'etm' | 'petrobras' | 'sem_atraso' | 'impedimento');
      }
      if (frenteFilter !== 'all') {
        query = query.contains('frente_ids', [frenteFilter]);
      }
      if (disciplinaFilter !== 'all') {
        query = query.contains('disciplina_ids', [disciplinaFilter]);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch events for all PTs
        const ptIds = data.map(p => p.id);
        const { data: eventos } = await supabase
          .from('eventos')
          .select('pt_id, tipo_evento, criado_em')
          .in('pt_id', ptIds);

        // Collect all unique frente and disciplina IDs
        const allFrenteIds = new Set<string>();
        const allDisciplinaIds = new Set<string>();
        
        data.forEach(pt => {
          const fIds = (pt as any).frente_ids || ((pt as any).frente_id ? [(pt as any).frente_id] : []);
          const dIds = (pt as any).disciplina_ids || ((pt as any).disciplina_id ? [(pt as any).disciplina_id] : []);
          fIds.forEach((id: string) => allFrenteIds.add(id));
          dIds.forEach((id: string) => allDisciplinaIds.add(id));
        });

        // Fetch names for frentes and disciplinas
        const frenteNamesMap: Record<string, string> = {};
        const disciplinaNamesMap: Record<string, string> = {};

        if (allFrenteIds.size > 0) {
          const { data: frentesData } = await supabase
            .from('frentes')
            .select('id, nome')
            .in('id', Array.from(allFrenteIds));
          frentesData?.forEach(f => { frenteNamesMap[f.id] = f.nome; });
        }

        if (allDisciplinaIds.size > 0) {
          const { data: disciplinasData } = await supabase
            .from('disciplinas')
            .select('id, nome')
            .in('id', Array.from(allDisciplinaIds));
          disciplinasData?.forEach(d => { disciplinaNamesMap[d.id] = d.nome; });
        }

        // Map events to PTs and calculate HH Improdutivo
        const ptsWithEvents: PTReport[] = data.map(pt => {
          const ptEventos = eventos?.filter(e => e.pt_id === pt.id) || [];
          const solicitacao = ptEventos.find(e => e.tipo_evento === 'solicitacao');
          const chegada = ptEventos.find(e => e.tipo_evento === 'chegada');
          const liberacao = ptEventos.find(e => e.tipo_evento === 'liberacao');

          const atrasoETM = Number(pt.atraso_etm) || 0;
          const atrasoPetrobras = Number(pt.atraso_petrobras) || 0;
          const efetivoQtd = pt.efetivo_qtd || 1;
          const hhImprodutivo = efetivoQtd * (atrasoETM + atrasoPetrobras);

          const fIds = (pt as any).frente_ids || ((pt as any).frente_id ? [(pt as any).frente_id] : []);
          const dIds = (pt as any).disciplina_ids || ((pt as any).disciplina_id ? [(pt as any).disciplina_id] : []);
          
          const frentesNomes = fIds.map((id: string) => frenteNamesMap[id]).filter(Boolean);
          const disciplinasNomes = dIds.map((id: string) => disciplinaNamesMap[id]).filter(Boolean);

          return {
            ...pt,
            hora_solicitacao: solicitacao?.criado_em || null,
            hora_chegada: chegada?.criado_em || null,
            hora_liberacao: liberacao?.criado_em || null,
            efetivo_qtd: efetivoQtd,
            atraso_etm: atrasoETM,
            atraso_petrobras: atrasoPetrobras,
            hh_improdutivo: hhImprodutivo,
            frente_ids: fIds,
            disciplina_ids: dIds,
            frentesNomes,
            disciplinasNomes,
          } as PTReport;
        });

        setPTs(ptsWithEvents);
        
        // Calculate stats
        const liberadas = data.filter(p => p.status === 'liberada').length;
        const impedidas = data.filter(p => p.status === 'impedida').length;
        const atrasosETM = data.filter(p => p.responsavel_atraso === 'etm').length;
        const atrasosPetrobras = data.filter(p => p.responsavel_atraso === 'petrobras').length;
        const totalHHImprodutivo = ptsWithEvents.reduce((acc, pt) => acc + (pt.hh_improdutivo || 0), 0);
        
        setStats({
          total: data.length,
          liberadas,
          impedidas,
          atrasosETM,
          atrasosPetrobras,
          tempoMedioLiberacao: '-',
          totalHHImprodutivo,
        });
      } else {
        setPTs([]);
        setStats({
          total: 0,
          liberadas: 0,
          impedidas: 0,
          atrasosETM: 0,
          atrasosPetrobras: 0,
          tempoMedioLiberacao: '-',
          totalHHImprodutivo: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatEventTime(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'HH:mm');
    } catch {
      return '-';
    }
  }

  function getExportData() {
    return pts.map(pt => ({
      'Número PT': pt.numero_pt,
      'Tipo': pt.tipo_pt.toUpperCase(),
      'Data Serviço': format(parseISO(pt.data_servico), 'dd/MM/yyyy'),
      'Frente(s)': pt.frentesNomes?.join(', ') || pt.frentes?.nome || '-',
      'Disciplina(s)': pt.disciplinasNomes?.join(', ') || pt.disciplinas?.nome || '-',
      'Encarregado': pt.encarregado_nome || '-',
      'Matrícula': pt.encarregado_matricula || '-',
      'Qtd. Efetivo': pt.efetivo_qtd || 1,
      'Descrição Operação': pt.descricao_operacao || '-',
      'Hora Solicitação': formatEventTime(pt.hora_solicitacao),
      'Hora Chegada': formatEventTime(pt.hora_chegada),
      'Hora Liberação': formatEventTime(pt.hora_liberacao),
      'Status': pt.status,
      'Responsável Atraso': pt.responsavel_atraso || 'Sem atraso',
      'Atraso ETM (min)': pt.atraso_etm || 0,
      'Atraso Petrobras (min)': pt.atraso_petrobras || 0,
      'HH Improdutivo (min)': pt.hh_improdutivo || 0,
      'Causa Atraso': pt.causa_atraso || '-',
    }));
  }

  async function exportToExcel() {
    setExporting(true);
    try {
      const data = getExportData();
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório PTs');
      
      // Auto-size columns
      const colWidths = Object.keys(data[0] || {}).map(key => ({ wch: Math.max(key.length, 15) }));
      worksheet['!cols'] = colWidths;
      
      XLSX.writeFile(workbook, `relatorio_pts_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    } finally {
      setExporting(false);
    }
  }

  async function exportToPDF() {
    setExporting(true);
    try {
      const doc = new jsPDF('landscape');
      
      // Title
      doc.setFontSize(18);
      doc.text('Relatório de PTs', 14, 22);
      
      // Subtitle with date range
      doc.setFontSize(10);
      doc.text(
        `Período: ${format(parseISO(dataInicio), 'dd/MM/yyyy')} a ${format(parseISO(dataFim), 'dd/MM/yyyy')}`,
        14, 30
      );
      
      // Stats summary
      doc.text(`Total: ${stats.total} | Liberadas: ${stats.liberadas} | Impedidas: ${stats.impedidas} | HH Improdutivo Total: ${stats.totalHHImprodutivo} min`, 14, 36);
      
      // Table data
      const tableData = pts.map(pt => [
        pt.numero_pt,
        pt.tipo_pt.toUpperCase(),
        format(parseISO(pt.data_servico), 'dd/MM/yyyy'),
        pt.frentes?.nome || '-',
        pt.encarregado_nome || '-',
        pt.efetivo_qtd || 1,
        formatEventTime(pt.hora_solicitacao),
        formatEventTime(pt.hora_liberacao),
        pt.status,
        pt.hh_improdutivo || 0,
        (pt.causa_atraso || '-').substring(0, 30),
      ]);

      autoTable(doc, {
        head: [['Número', 'Tipo', 'Data', 'Frente', 'Encarregado', 'Efetivo', 'Solicit.', 'Liberação', 'Status', 'HH Improd.', 'Causa']],
        body: tableData,
        startY: 42,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [30, 64, 175] },
      });

      doc.save(`relatorio_pts_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
    } finally {
      setExporting(false);
    }
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="px-4 py-6">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Você não tem permissão para acessar relatórios.
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Relatórios</h1>
            <p className="text-muted-foreground">Análise e exportação de dados</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToExcel}
              disabled={exporting || pts.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToPDF}
              disabled={exporting || pts.length === 0}
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="solicitada">Solicitada</SelectItem>
                    <SelectItem value="chegada">Chegada</SelectItem>
                    <SelectItem value="liberada">Liberada</SelectItem>
                    <SelectItem value="impedida">Impedida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Responsável</Label>
                <Select value={responsavelFilter} onValueChange={setResponsavelFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="etm">Atraso ETM</SelectItem>
                    <SelectItem value="petrobras">Atraso Petrobras</SelectItem>
                    <SelectItem value="sem_atraso">No prazo</SelectItem>
                    <SelectItem value="impedimento">Impedida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Frente</Label>
                <Select value={frenteFilter} onValueChange={setFrenteFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {frentes.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Disciplina</Label>
                <Select value={disciplinaFilter} onValueChange={setDisciplinaFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {disciplinas.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-xs text-muted-foreground">Liberadas</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.liberadas}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-xs text-muted-foreground">Atraso ETM</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.atrasosETM}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-xs text-muted-foreground">Atraso Petrobras</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.atrasosPetrobras}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Impedidas</span>
              </div>
              <p className="text-2xl font-bold mt-1">{stats.impedidas}</p>
            </CardContent>
          </Card>
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-destructive" />
                <span className="text-xs text-muted-foreground">HH Improd.</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-destructive">{stats.totalHHImprodutivo} <span className="text-sm font-normal">min</span></p>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Resultados ({pts.length} registros)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : pts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Frente</TableHead>
                      <TableHead>Encarregado</TableHead>
                      <TableHead className="text-center">Efetivo</TableHead>
                      <TableHead className="text-center">Solicitação</TableHead>
                      <TableHead className="text-center">Chegada</TableHead>
                      <TableHead className="text-center">Liberação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">HH Improd.</TableHead>
                      <TableHead>Causa Atraso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pts.map((pt) => (
                      <TableRow key={pt.id}>
                        <TableCell className="font-medium">
                          {pt.numero_pt}
                          <span className="text-xs text-muted-foreground ml-1">
                            {pt.tipo_pt.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(pt.data_servico), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>{pt.frentesNomes?.join(', ') || pt.frentes?.nome || '-'}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {pt.encarregado_nome || '-'}
                            {pt.encarregado_matricula && (
                              <span className="text-xs text-muted-foreground block">
                                {pt.encarregado_matricula}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{pt.efetivo_qtd || 1}</TableCell>
                        <TableCell className="text-center font-mono text-sm">
                          {formatEventTime(pt.hora_solicitacao)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">
                          {formatEventTime(pt.hora_chegada)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">
                          {formatEventTime(pt.hora_liberacao)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={pt.status} />
                        </TableCell>
                        <TableCell className="text-center">
                          {(pt.hh_improdutivo || 0) > 0 ? (
                            <span className="text-destructive font-semibold">{pt.hh_improdutivo}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="text-sm truncate block" title={pt.causa_atraso || ''}>
                            {pt.causa_atraso || '-'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
