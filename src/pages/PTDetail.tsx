import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useGeolocation } from '@/hooks/useGeolocation';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge, DelayBadge } from '@/components/pt/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Loader2,
  Play,
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  User,
  Calendar,
  QrCode,
  Users,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateBR } from '@/lib/date-utils';
import { toast } from 'sonner';
import QRCode from 'qrcode';

interface PT {
  id: string;
  numero_pt: string;
  tipo_pt: string;
  data_servico: string;
  status: string;
  responsavel_atraso: string | null;
  tempo_ate_chegada: string | null;
  tempo_ate_liberacao: string | null;
  equipe: string | null;
  criado_em: string;
  criado_por: string;
  efetivo_qtd: number;
  encarregado_nome: string | null;
  encarregado_matricula: string | null;
  descricao_operacao: string | null;
  causa_atraso: string | null;
  atraso_etm: number;
  atraso_petrobras: number;
  frente_ids: string[];
  disciplina_ids: string[];
  frentes?: { id: string; nome: string } | null;
  disciplinas?: { id: string; nome: string } | null;
  profiles?: { nome: string } | null;
  // Para exibição de múltiplos
  frentesNomes?: string[];
  disciplinasNomes?: string[];
}

interface Evento {
  id: string;
  tipo_evento: string;
  criado_em: string;
  criado_por: string;
  lat: number | null;
  lon: number | null;
  accuracy: number | null;
  observacao: string | null;
  confirmacao_status: string | null;
  confirmado_por: string | null;
  confirmado_em: string | null;
  impedimento_id: string | null;
  detalhe_impedimento: string | null;
  profiles?: { nome: string } | null;
  impedimentos?: { nome: string } | null;
}

interface Impedimento {
  id: string;
  nome: string;
}

const eventConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  solicitacao: { label: 'Solicitação', icon: <Play className="h-4 w-4" />, color: 'bg-info' },
  chegada: { label: 'Chegada do Operador', icon: <UserCheck className="h-4 w-4" />, color: 'bg-warning' },
  liberacao: { label: 'Liberação', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-success' },
  impedimento: { label: 'Impedimento', icon: <XCircle className="h-4 w-4" />, color: 'bg-destructive' },
};

export default function PTDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isEncarregado, isOperador, canActAsEncarregado, canActAsOperador } = useAuth();
  const { getLocation, loading: geoLoading } = useGeolocation();
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pt, setPT] = useState<PT | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [impedimentos, setImpedimentos] = useState<Impedimento[]>([]);
  
  // Dialogs
  const [showImpedimentoDialog, setShowImpedimentoDialog] = useState(false);
  const [selectedImpedimento, setSelectedImpedimento] = useState('');
  const [detalheImpedimento, setDetalheImpedimento] = useState('');
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  // Causa atraso dialog
  const [showCausaAtrasoDialog, setShowCausaAtrasoDialog] = useState(false);
  const [causaAtraso, setCausaAtraso] = useState('');

  useEffect(() => {
    if (id) {
      fetchPTData();
      fetchImpedimentos();
    }
  }, [id]);

  async function fetchPTData() {
    setLoading(true);
    try {
      // Fetch PT with related data
      const { data: ptData, error: ptError } = await supabase
        .from('pts')
        .select(`
          *,
          frentes (id, nome),
          disciplinas (id, nome)
        `)
        .eq('id', id)
        .maybeSingle();

      if (ptError) throw ptError;
      if (!ptData) {
        toast.error('PT não encontrada');
        navigate('/pts');
        return;
      }

      // Fetch creator profile separately
      const { data: creatorProfile } = await supabase
        .from('profiles_directory')
        .select('nome')
        .eq('id', ptData.criado_por)
        .maybeSingle();

      // Fetch names for multiple frentes/disciplinas
      let frentesNomes: string[] = [];
      let disciplinasNomes: string[] = [];

      const frenteIds = ptData.frente_ids || (ptData.frente_id ? [ptData.frente_id] : []);
      const disciplinaIds = ptData.disciplina_ids || (ptData.disciplina_id ? [ptData.disciplina_id] : []);

      if (frenteIds.length > 0) {
        const { data: frentesData } = await supabase
          .from('frentes')
          .select('nome')
          .in('id', frenteIds);
        frentesNomes = frentesData?.map(f => f.nome) || [];
      }

      if (disciplinaIds.length > 0) {
        const { data: disciplinasData } = await supabase
          .from('disciplinas')
          .select('nome')
          .in('id', disciplinaIds);
        disciplinasNomes = disciplinasData?.map(d => d.nome) || [];
      }

      setPT({
        ...ptData,
        profiles: creatorProfile,
        efetivo_qtd: ptData.efetivo_qtd || 1,
        atraso_etm: Number(ptData.atraso_etm) || 0,
        atraso_petrobras: Number(ptData.atraso_petrobras) || 0,
        frente_ids: frenteIds,
        disciplina_ids: disciplinaIds,
        frentesNomes,
        disciplinasNomes,
      } as unknown as PT);

      // Fetch events
      const { data: eventosData, error: eventosError } = await supabase
        .from('eventos')
        .select(`
          *,
          impedimentos (nome)
        `)
        .eq('pt_id', id)
        .order('criado_em', { ascending: true });

      if (eventosError) throw eventosError;

      // Fetch profiles for events
      const eventosWithProfiles = await Promise.all(
        (eventosData || []).map(async (evento) => {
          const { data: profile } = await supabase
            .from('profiles_directory')
            .select('nome')
            .eq('id', evento.criado_por)
            .maybeSingle();
          return { ...evento, profiles: profile };
        })
      );

      setEventos(eventosWithProfiles as unknown as Evento[]);
    } catch (error) {
      console.error('Error fetching PT:', error);
      toast.error('Erro ao carregar PT');
    } finally {
      setLoading(false);
    }
  }

  async function fetchImpedimentos() {
    const { data } = await supabase
      .from('impedimentos')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');
    
    if (data) setImpedimentos(data);
  }

  // Calculate delays based on events and SLA
  function calcularAtrasos(): { atrasoETM: number; atrasoPetrobras: number } {
    const solicitacao = eventos.find(e => e.tipo_evento === 'solicitacao');
    const liberacao = eventos.find(e => e.tipo_evento === 'liberacao');
    
    if (!solicitacao) return { atrasoETM: 0, atrasoPetrobras: 0 };

    const horaLimiteSolicitacao = '07:30:00';
    const horaLimiteLiberacao = '08:15:00';
    
    const horaSolicitacao = format(new Date(solicitacao.criado_em), 'HH:mm:ss');
    
    let atrasoETM = 0;
    let atrasoPetrobras = 0;
    
    // Atraso ETM: solicitação após 07:30
    if (horaSolicitacao > horaLimiteSolicitacao) {
      const [h, m] = horaSolicitacao.split(':').map(Number);
      const [lh, lm] = horaLimiteSolicitacao.split(':').map(Number);
      atrasoETM = (h * 60 + m) - (lh * 60 + lm);
    }
    
    // Atraso Petrobras: liberação após 08:15 (quando solicitação foi no prazo)
    if (liberacao) {
      const horaLiberacao = format(new Date(liberacao.criado_em), 'HH:mm:ss');
      if (horaSolicitacao <= horaLimiteSolicitacao && horaLiberacao > horaLimiteLiberacao) {
        const [h, m] = horaLiberacao.split(':').map(Number);
        const [lh, lm] = horaLimiteLiberacao.split(':').map(Number);
        atrasoPetrobras = (h * 60 + m) - (lh * 60 + lm);
      }
    }
    
    return { atrasoETM, atrasoPetrobras };
  }

  // Calculate HH Improdutivo
  function calcularHHImprodutivo(): number {
    if (!pt) return 0;
    const atrasoTotal = (pt.atraso_etm || 0) + (pt.atraso_petrobras || 0);
    return (pt.efetivo_qtd || 1) * atrasoTotal;
  }

  // Check if has delay (needs causa_atraso)
  function hasAtraso(): boolean {
    if (!pt) return false;
    return ((pt.atraso_etm || 0) + (pt.atraso_petrobras || 0)) > 0;
  }

  async function registrarEvento(tipo: 'solicitacao' | 'chegada' | 'liberacao' | 'impedimento', options?: {
    impedimentoId?: string;
    detalheImpedimento?: string;
    pendente?: boolean;
  }) {
    if (!user || !pt) return;
    
    setActionLoading(true);
    try {
      // Get geolocation
      const location = await getLocation();
      
      // Create event
      const { error: eventoError } = await supabase
        .from('eventos')
        .insert({
          pt_id: pt.id,
          tipo_evento: tipo,
          criado_por: user.id,
          lat: location?.lat || null,
          lon: location?.lon || null,
          accuracy: location?.accuracy || null,
          ip: null,
          user_agent: navigator.userAgent,
          confirmacao_status: options?.pendente ? 'pendente' : 'confirmado',
          impedimento_id: options?.impedimentoId || null,
          detalhe_impedimento: options?.detalheImpedimento || null,
        });

      if (eventoError) throw eventoError;

      // Update PT status
      let newStatus: string = pt.status;
      let responsavelAtraso: string | null = pt.responsavel_atraso;
      let atrasoETM = 0;
      let atrasoPetrobras = 0;

      switch (tipo) {
        case 'solicitacao':
          newStatus = 'solicitada';
          break;
        case 'chegada':
          newStatus = 'chegada';
          break;
        case 'liberacao':
          newStatus = 'liberada';
          // Calculate delays
          const delays = calcularAtrasos();
          atrasoETM = delays.atrasoETM;
          atrasoPetrobras = delays.atrasoPetrobras;
          
          if (atrasoETM > 0) {
            responsavelAtraso = 'etm';
          } else if (atrasoPetrobras > 0) {
            responsavelAtraso = 'petrobras';
          } else {
            responsavelAtraso = 'sem_atraso';
          }
          break;
        case 'impedimento':
          newStatus = 'impedida';
          responsavelAtraso = 'impedimento';
          break;
      }

      const updateData: any = { 
        status: newStatus as 'pendente' | 'solicitada' | 'chegada' | 'liberada' | 'impedida',
        responsavel_atraso: responsavelAtraso as 'etm' | 'petrobras' | 'sem_atraso' | 'impedimento' | null,
      };
      
      if (tipo === 'liberacao') {
        updateData.atraso_etm = atrasoETM;
        updateData.atraso_petrobras = atrasoPetrobras;
      }

      const { error: updateError } = await supabase
        .from('pts')
        .update(updateData)
        .eq('id', pt.id);

      if (updateError) throw updateError;

      toast.success(`${eventConfig[tipo].label} registrada com sucesso!`);
      fetchPTData();
    } catch (error) {
      console.error('Error registering event:', error);
      toast.error('Erro ao registrar evento');
    } finally {
      setActionLoading(false);
      setShowImpedimentoDialog(false);
    }
  }

  async function handleLiberarClick() {
    // If there's a delay, show causa dialog first
    const delays = calcularAtrasos();
    if (delays.atrasoETM > 0 || delays.atrasoPetrobras > 0) {
      setShowCausaAtrasoDialog(true);
    } else {
      await registrarEvento('liberacao');
    }
  }

  async function handleSaveCausaAtraso() {
    if (!causaAtraso.trim()) {
      toast.error('A causa do atraso é obrigatória');
      return;
    }

    if (!pt) return;

    setActionLoading(true);
    try {
      // Save causa_atraso
      const { error: causaError } = await supabase
        .from('pts')
        .update({ causa_atraso: causaAtraso })
        .eq('id', pt.id);

      if (causaError) throw causaError;

      // Then register liberacao
      await registrarEvento('liberacao');
      setShowCausaAtrasoDialog(false);
      setCausaAtraso('');
    } catch (error) {
      console.error('Error saving causa atraso:', error);
      toast.error('Erro ao salvar causa do atraso');
      setActionLoading(false);
    }
  }

  async function generateQRCode() {
    const url = `${window.location.origin}/pt/${id}`;
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#0c4a6e',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qrDataUrl);
      setShowQRDialog(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Erro ao gerar QR Code');
    }
  }

  function downloadQRCode() {
    const link = document.createElement('a');
    link.download = `PT-${pt?.numero_pt}-QRCode.png`;
    link.href = qrCodeUrl;
    link.click();
  }

  const hasEvent = (tipo: string) => eventos.some(e => e.tipo_evento === tipo);
  
  const canSolicitar = isEncarregado && pt?.status === 'pendente' && !hasEvent('solicitacao');
  const canChegada = isEncarregado && hasEvent('solicitacao') && !hasEvent('chegada');
  const canLiberar = isOperador && hasEvent('chegada') && !hasEvent('liberacao') && !hasEvent('impedimento');
  const canImpedir = isOperador && hasEvent('chegada') && !hasEvent('liberacao') && !hasEvent('impedimento');

  const hhImprodutivo = calcularHHImprodutivo();
  const totalAtraso = (pt?.atraso_etm || 0) + (pt?.atraso_petrobras || 0);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!pt) {
    return (
      <AppLayout>
        <div className="px-4 py-6">
          <Alert variant="destructive">
            <AlertDescription>PT não encontrada</AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{pt.numero_pt}</h1>
              <Badge variant="outline" className="uppercase">{pt.tipo_pt}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {pt.frentesNomes?.join(', ') || pt.frentes?.nome || 'Sem frente'} • {pt.disciplinasNomes?.join(', ') || pt.disciplinas?.nome || 'Sem disciplina'}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={generateQRCode}>
            <QrCode className="h-5 w-5" />
          </Button>
        </div>

        {/* Status card */}
        <Card className="overflow-hidden">
          <div className={`h-2 ${
            pt.status === 'liberada' ? 'bg-success' :
            pt.status === 'impedida' ? 'bg-destructive' :
            pt.status === 'chegada' ? 'bg-warning' :
            pt.status === 'solicitada' ? 'bg-info' :
            'bg-muted'
          }`} />
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <StatusBadge status={pt.status} />
              {isAdmin && pt.responsavel_atraso && <DelayBadge responsavel={pt.responsavel_atraso} />}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{formatDateBR(pt.data_servico)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{format(new Date(pt.criado_em), "HH:mm")}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{pt.profiles?.nome || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Efetivo: {pt.efetivo_qtd || 1}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Encarregado Card */}
        {(pt.encarregado_nome || pt.encarregado_matricula) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Encarregado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Nome</p>
                  <p className="font-medium">{pt.encarregado_nome || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Matrícula</p>
                  <p className="font-medium">{pt.encarregado_matricula || '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Descrição da Operação */}
        {pt.descricao_operacao && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Descrição da Operação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{pt.descricao_operacao}</p>
            </CardContent>
          </Card>
        )}

        {/* Atrasos Card - Admin only */}
        {isAdmin && (pt.status === 'liberada' || pt.status === 'impedida') && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Atrasos e HH Improdutivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-muted-foreground text-xs">Atraso ETM</p>
                  <p className="font-medium">{pt.atraso_etm || 0} min</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Atraso Petrobras</p>
                  <p className="font-medium">{pt.atraso_petrobras || 0} min</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">HH Improdutivo</p>
                  <p className="font-bold text-destructive">{hhImprodutivo} min</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Qtd. Efetivo</p>
                  <p className="font-medium">{pt.efetivo_qtd || 1}</p>
                </div>
              </div>
              
              {totalAtraso > 0 && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground text-xs mb-1">Causa do Atraso</p>
                  <p className="text-sm">{pt.causa_atraso || <span className="text-muted-foreground italic">Não informada</span>}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Operator waiting message - when PT is solicitada but not yet chegada */}
        {isOperador && pt.status === 'solicitada' && !hasEvent('chegada') && (
          <Alert className="border-info bg-info/10">
            <Clock className="h-4 w-4 text-info" />
            <AlertDescription className="text-info font-medium">
              Operador ETM solicitou PT. Aguardando confirmação de chegada do operador.
            </AlertDescription>
          </Alert>
        )}

        {/* Action buttons */}
        {(canSolicitar || canChegada || canLiberar || canImpedir) && (
          <div className="grid grid-cols-2 gap-3">
            {canSolicitar && (
              <Button 
                className="h-14 text-base font-semibold col-span-2 gradient-primary"
                onClick={() => registrarEvento('solicitacao')}
                disabled={actionLoading || geoLoading}
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Solicitar Liberação
                  </>
                )}
              </Button>
            )}
            {canChegada && (
              <Button 
                className="h-14 text-base font-semibold col-span-2 bg-warning text-warning-foreground hover:bg-warning/90"
                onClick={() => registrarEvento('chegada', { pendente: !isOperador })}
                disabled={actionLoading || geoLoading}
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    <UserCheck className="h-5 w-5 mr-2" />
                    {isOperador ? 'Confirmar Chegada' : 'Registrar Chegada (Pendente)'}
                  </>
                )}
              </Button>
            )}
            {canLiberar && (
              <Button 
                className="h-14 text-base font-semibold gradient-success"
                onClick={handleLiberarClick}
                disabled={actionLoading || geoLoading}
              >
                {actionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Liberar
                  </>
                )}
              </Button>
            )}
            {canImpedir && (
              <Button 
                variant="destructive"
                className="h-14 text-base font-semibold"
                onClick={() => setShowImpedimentoDialog(true)}
                disabled={actionLoading || geoLoading}
              >
                <XCircle className="h-5 w-5 mr-2" />
                Impedimento
              </Button>
            )}
          </div>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Linha do Tempo</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {eventos.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhum evento registrado
              </p>
            ) : (
              <div className="relative">
                {eventos.map((evento, index) => {
                  const config = eventConfig[evento.tipo_evento] || eventConfig.solicitacao;
                  const isLast = index === eventos.length - 1;

                  return (
                    <div key={evento.id} className="relative flex gap-4 pb-6">
                      {!isLast && (
                        <div className="timeline-line bg-border" style={{ top: '24px', height: 'calc(100% - 8px)' }} />
                      )}
                      
                      <div className={`timeline-dot ${config.color} text-white flex items-center justify-center z-10`}>
                        {config.icon}
                      </div>

                      <div className="flex-1 pt-0.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold">{config.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {evento.profiles?.nome || 'Usuário'}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-medium">{format(new Date(evento.criado_em), 'HH:mm:ss')}</p>
                            <p className="text-muted-foreground text-xs">
                              {formatDistanceToNow(new Date(evento.criado_em), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        </div>

                        {evento.confirmacao_status === 'pendente' && (
                          <Badge variant="outline" className="mt-2 bg-warning/10 text-warning border-warning/30">
                            Pendente de confirmação
                          </Badge>
                        )}

                        {evento.impedimentos?.nome && (
                          <div className="mt-2 p-2 bg-destructive/10 rounded-lg">
                            <p className="text-sm font-medium text-destructive">{evento.impedimentos.nome}</p>
                            {evento.detalhe_impedimento && (
                              <p className="text-xs text-muted-foreground mt-1">{evento.detalhe_impedimento}</p>
                            )}
                          </div>
                        )}

                        {evento.lat && evento.lon && (
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{evento.lat.toFixed(6)}, {evento.lon.toFixed(6)}</span>
                            {evento.accuracy && <span>(±{evento.accuracy.toFixed(0)}m)</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Impedimento Dialog */}
      <Dialog open={showImpedimentoDialog} onOpenChange={setShowImpedimentoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Impedimento</DialogTitle>
            <DialogDescription>
              Selecione o motivo do impedimento e adicione detalhes se necessário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Select value={selectedImpedimento} onValueChange={setSelectedImpedimento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {impedimentos.map((imp) => (
                    <SelectItem key={imp.id} value={imp.id}>{imp.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Textarea
                placeholder="Detalhes adicionais (opcional)"
                value={detalheImpedimento}
                onChange={(e) => setDetalheImpedimento(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImpedimentoDialog(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => registrarEvento('impedimento', {
                impedimentoId: selectedImpedimento,
                detalheImpedimento,
              })}
              disabled={!selectedImpedimento || actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar Impedimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Causa Atraso Dialog */}
      <Dialog open={showCausaAtrasoDialog} onOpenChange={setShowCausaAtrasoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Causa do Atraso</DialogTitle>
            <DialogDescription>
              Foi detectado atraso nesta PT. Informe a causa antes de liberar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="causa">Causa do Atraso *</Label>
              <Textarea
                id="causa"
                placeholder="Descreva a causa do atraso..."
                value={causaAtraso}
                onChange={(e) => setCausaAtraso(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCausaAtrasoDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveCausaAtraso}
              disabled={!causaAtraso.trim() || actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Liberar PT'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="text-center">
          <DialogHeader>
            <DialogTitle>QR Code da PT</DialogTitle>
            <DialogDescription>
              Escaneie para acessar esta PT
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="rounded-lg" />}
          </div>
          <p className="text-sm font-mono bg-muted p-2 rounded">
            {pt.numero_pt}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQRDialog(false)}>
              Fechar
            </Button>
            <Button onClick={downloadQRCode}>
              Baixar PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
