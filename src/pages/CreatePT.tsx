import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';
import { toast } from 'sonner';

interface Frente {
  id: string;
  nome: string;
}

interface Disciplina {
  id: string;
  nome: string;
}

const ptSchema = z.object({
  numero_pt: z.string().min(1, 'Número da PT é obrigatório').max(50),
  tipo_pt: z.enum(['pt', 'ptt']),
  data_servico: z.string().min(1, 'Data é obrigatória'),
  frente_id: z.string().min(1, 'Frente é obrigatória'),
  disciplina_id: z.string().min(1, 'Disciplina é obrigatória'),
  equipe: z.string().max(200).optional(),
});

export default function CreatePT() {
  const navigate = useNavigate();
  const { user, isEncarregado } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);

  // Form state
  const [numeroPT, setNumeroPT] = useState('');
  const [tipoPT, setTipoPT] = useState<'pt' | 'ptt'>('pt');
  const [dataServico, setDataServico] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [frenteId, setFrenteId] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('');
  const [equipe, setEquipe] = useState('');

  useEffect(() => {
    fetchSelectData();
  }, []);

  async function fetchSelectData() {
    const [frentesRes, disciplinasRes] = await Promise.all([
      supabase.from('frentes').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('disciplinas').select('id, nome').eq('ativo', true).order('nome'),
    ]);

    if (frentesRes.data) setFrentes(frentesRes.data);
    if (disciplinasRes.data) setDisciplinas(disciplinasRes.data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate
      const validation = ptSchema.safeParse({
        numero_pt: numeroPT,
        tipo_pt: tipoPT,
        data_servico: dataServico,
        frente_id: frenteId,
        disciplina_id: disciplinaId,
        equipe: equipe || undefined,
      });

      if (!validation.success) {
        setError(validation.error.errors[0].message);
        setLoading(false);
        return;
      }

      if (!user) {
        setError('Você precisa estar logado');
        setLoading(false);
        return;
      }

      // Create PT
      const { data: pt, error: ptError } = await supabase
        .from('pts')
        .insert({
          numero_pt: numeroPT,
          tipo_pt: tipoPT,
          data_servico: dataServico,
          frente_id: frenteId,
          disciplina_id: disciplinaId,
          equipe: equipe || null,
          criado_por: user.id,
          status: 'pendente',
        })
        .select()
        .single();

      if (ptError) throw ptError;

      toast.success('PT criada com sucesso!');
      navigate(`/pt/${pt.id}`);
    } catch (err: any) {
      console.error('Error creating PT:', err);
      setError('Erro ao criar PT. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  if (!isEncarregado) {
    return (
      <AppLayout>
        <div className="px-4 py-6">
          <Alert variant="destructive">
            <AlertDescription>
              Você não tem permissão para criar PTs. Apenas encarregados e administradores podem criar.
            </AlertDescription>
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
          <h1 className="text-xl font-bold">Nova PT</h1>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da PT</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numero">Número da PT *</Label>
                  <Input
                    id="numero"
                    placeholder="Ex: PT-001"
                    value={numeroPT}
                    onChange={(e) => setNumeroPT(e.target.value)}
                    required
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo *</Label>
                  <Select value={tipoPT} onValueChange={(v: 'pt' | 'ptt') => setTipoPT(v)}>
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt">PT</SelectItem>
                      <SelectItem value="ptt">PTT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data">Data do Serviço *</Label>
                <Input
                  id="data"
                  type="date"
                  value={dataServico}
                  onChange={(e) => setDataServico(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="frente">Frente de Serviço *</Label>
                <Select value={frenteId} onValueChange={setFrenteId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione a frente" />
                  </SelectTrigger>
                  <SelectContent>
                    {frentes.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="disciplina">Disciplina *</Label>
                <Select value={disciplinaId} onValueChange={setDisciplinaId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione a disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplinas.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="equipe">Equipe (opcional)</Label>
                <Input
                  id="equipe"
                  placeholder="Nome ou identificação da equipe"
                  value={equipe}
                  onChange={(e) => setEquipe(e.target.value)}
                  className="h-12"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    Criar PT
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
