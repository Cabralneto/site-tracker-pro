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
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
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
  frentes?: { id: string; nome: string } | null;
  disciplinas?: { id: string; nome: string } | null;
  profiles?: { nome: string } | null;
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
  chegada: { label: 'Chegada', icon: <UserCheck className="h-4 w-4" />, color: 'bg-warning' },
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
        .from('profiles')
        .select('nome')
        .eq('id', ptData.criado_por)
        .maybeSingle();

      setPT({
        ...ptData,
        profiles: creatorProfile,
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
            .from('profiles')
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
          ip: null, // Would need edge function to capture
          user_agent: navigator.userAgent,
          confirmacao_status: options?.pendente ? 'pendente' : 'confirmado',
          impedimento_id: options?.impedimentoId || null,
          detalhe_impedimento: options?.detalheImpedimento || null,
        });

      if (eventoError) throw eventoError;

      // Update PT status
      let newStatus: string = pt.status;
      let responsavelAtraso: string | null = pt.responsavel_atraso;

      switch (tipo) {
        case 'solicitacao':
          newStatus = 'solicitada';
          break;
        case 'chegada':
          newStatus = 'chegada';
          break;
        case 'liberacao':
          newStatus = 'liberada';
          // Calculate delay responsibility
          responsavelAtraso = await calcularResponsavel();
          break;
        case 'impedimento':
          newStatus = 'impedida';
          responsavelAtraso = 'impedimento';
          break;
      }

      const { error: updateError } = await supabase
        .from('pts')
        .update({ 
          status: newStatus as 'pendente' | 'solicitada' | 'chegada' | 'liberada' | 'impedida',
          responsavel_atraso: responsavelAtraso as 'etm' | 'petrobras' | 'sem_atraso' | 'impedimento' | null,
        })
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

  async function calcularResponsavel(): Promise<string> {
    // Get SLA config
    const { data: slaConfig } = await supabase
      .from('sla_config')
      .select('hora_limite_solicitacao, hora_limite_liberacao')
      .eq('ativo', true)
      .maybeSingle();

    const horaLimiteSolicitacao = slaConfig?.hora_limite_solicitacao || '07:30:00';
    const horaLimiteLiberacao = slaConfig?.hora_limite_liberacao || '08:15:00';

    // Find solicitacao event
    const solicitacao = eventos.find(e => e.tipo_evento === 'solicitacao');
    if (!solicitacao) return 'sem_atraso';

    const horaSolicitacao = format(new Date(solicitacao.criado_em), 'HH:mm:ss');
    const horaLiberacao = format(new Date(), 'HH:mm:ss');

    // Check delay
    if (horaSolicitacao > horaLimiteSolicitacao) {
      return 'etm'; // ETM requested late
    }
    
    if (horaLiberacao > horaLimiteLiberacao) {
      return 'petrobras'; // Petrobras released late
    }

    return 'sem_atraso';
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
  
  // Fluxo correto:
  // 1. Admin cria PT (pendente)
  // 2. Encarregado solicita liberação (solicitada) 
  // 3. Encarregado registra chegada (chegada)
  // 4. Operador libera OU registra impedimento (liberada/impedida)
  
  // Encarregado: solicita liberação em PTs pendentes
  const canSolicitar = isEncarregado && pt?.status === 'pendente' && !hasEvent('solicitacao');
  
  // Apenas Encarregado: registra chegada do operador (após solicitar)
  const canChegada = isEncarregado && hasEvent('solicitacao') && !hasEvent('chegada');
  
  // Apenas Operador: libera a PT (somente após Encarregado confirmar chegada)
  const canLiberar = isOperador && hasEvent('chegada') && !hasEvent('liberacao') && !hasEvent('impedimento');
  
  // Apenas Operador: registra impedimento (somente após Encarregado confirmar chegada)
  const canImpedir = isOperador && hasEvent('chegada') && !hasEvent('liberacao') && !hasEvent('impedimento');

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
              {pt.frentes?.nome} • {pt.disciplinas?.nome}
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
              {/* DelayBadge só visível para Admin */}
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
              {pt.equipe && (
                <div className="text-muted-foreground">
                  Equipe: {pt.equipe}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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
                onClick={() => registrarEvento('liberacao')}
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
                      {/* Timeline line */}
                      {!isLast && (
                        <div className="timeline-line bg-border" style={{ top: '24px', height: 'calc(100% - 8px)' }} />
                      )}
                      
                      {/* Timeline dot */}
                      <div className={`timeline-dot ${config.color} text-white flex items-center justify-center z-10`}>
                        {config.icon}
                      </div>

                      {/* Content */}
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

                        {/* Event details */}
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
