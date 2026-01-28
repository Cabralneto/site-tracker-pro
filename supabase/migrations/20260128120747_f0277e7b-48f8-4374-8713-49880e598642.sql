-- Enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'encarregado', 'operador', 'visualizador');

-- Enum para status da PT
CREATE TYPE public.pt_status AS ENUM ('pendente', 'solicitada', 'chegada', 'liberada', 'impedida');

-- Enum para tipos de evento
CREATE TYPE public.tipo_evento AS ENUM ('solicitacao', 'chegada', 'liberacao', 'impedimento');

-- Enum para tipos de PT
CREATE TYPE public.tipo_pt AS ENUM ('pt', 'ptt');

-- Enum para responsável pelo atraso
CREATE TYPE public.responsavel_atraso AS ENUM ('etm', 'petrobras', 'sem_atraso', 'impedimento');

-- Enum para status de confirmação
CREATE TYPE public.confirmacao_status AS ENUM ('confirmado', 'pendente');

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de roles (separada por segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Tabela de frentes de serviço
CREATE TABLE public.frentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  area TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de disciplinas
CREATE TABLE public.disciplinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de motivos de impedimento
CREATE TABLE public.impedimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de configuração de SLA
CREATE TABLE public.sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hora_limite_solicitacao TIME NOT NULL DEFAULT '07:30:00',
  hora_limite_liberacao TIME NOT NULL DEFAULT '08:15:00',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ativo BOOLEAN DEFAULT true,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de PTs
CREATE TABLE public.pts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pt TEXT NOT NULL,
  tipo_pt tipo_pt NOT NULL DEFAULT 'pt',
  data_servico DATE NOT NULL DEFAULT CURRENT_DATE,
  frente_id UUID REFERENCES public.frentes(id),
  disciplina_id UUID REFERENCES public.disciplinas(id),
  equipe TEXT,
  status pt_status NOT NULL DEFAULT 'pendente',
  responsavel_atraso responsavel_atraso,
  tempo_ate_chegada INTERVAL,
  tempo_ate_liberacao INTERVAL,
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de eventos (trilha de auditoria imutável)
CREATE TABLE public.eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pt_id UUID NOT NULL REFERENCES public.pts(id) ON DELETE CASCADE,
  tipo_evento tipo_evento NOT NULL,
  criado_por UUID NOT NULL REFERENCES auth.users(id),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  ip TEXT,
  user_agent TEXT,
  observacao TEXT,
  foto_url TEXT,
  confirmacao_status confirmacao_status DEFAULT 'confirmado',
  confirmado_por UUID REFERENCES auth.users(id),
  confirmado_em TIMESTAMP WITH TIME ZONE,
  impedimento_id UUID REFERENCES public.impedimentos(id),
  detalhe_impedimento TEXT
);

-- Índices para performance
CREATE INDEX idx_pts_data_servico ON public.pts(data_servico);
CREATE INDEX idx_pts_status ON public.pts(status);
CREATE INDEX idx_pts_frente_id ON public.pts(frente_id);
CREATE INDEX idx_pts_disciplina_id ON public.pts(disciplina_id);
CREATE INDEX idx_eventos_pt_id ON public.eventos(pt_id);
CREATE INDEX idx_eventos_tipo ON public.eventos(tipo_evento);
CREATE INDEX idx_eventos_criado_em ON public.eventos(criado_em);

-- Função para verificar role do usuário
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para verificar se é admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Função para verificar se é encarregado ou admin
CREATE OR REPLACE FUNCTION public.is_encarregado_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'encarregado')
$$;

-- Função para verificar se é operador ou admin
CREATE OR REPLACE FUNCTION public.is_operador_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'operador')
$$;

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para atualizar atualizado_em
CREATE TRIGGER update_pts_updated_at
BEFORE UPDATE ON public.pts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Usuários podem ver todos os perfis" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários podem atualizar próprio perfil" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Usuários podem inserir próprio perfil" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Políticas para user_roles (apenas admin gerencia)
CREATE POLICY "Todos podem ver roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin pode inserir roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin pode atualizar roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admin pode deletar roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Políticas para frentes
CREATE POLICY "Todos podem ver frentes ativas" ON public.frentes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin pode gerenciar frentes" ON public.frentes FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Políticas para disciplinas
CREATE POLICY "Todos podem ver disciplinas" ON public.disciplinas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin pode gerenciar disciplinas" ON public.disciplinas FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Políticas para impedimentos
CREATE POLICY "Todos podem ver impedimentos" ON public.impedimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin pode gerenciar impedimentos" ON public.impedimentos FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Políticas para sla_config
CREATE POLICY "Todos podem ver SLA config" ON public.sla_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin pode gerenciar SLA config" ON public.sla_config FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

-- Políticas para pts
CREATE POLICY "Todos podem ver PTs" ON public.pts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Encarregado e admin podem criar PTs" ON public.pts FOR INSERT TO authenticated WITH CHECK (public.is_encarregado_or_admin(auth.uid()));
CREATE POLICY "Criador ou admin podem atualizar PTs" ON public.pts FOR UPDATE TO authenticated USING (criado_por = auth.uid() OR public.is_admin(auth.uid()));

-- Políticas para eventos (imutáveis - apenas INSERT)
CREATE POLICY "Todos podem ver eventos" ON public.eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários autenticados podem criar eventos" ON public.eventos FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid());

-- Trigger para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Dados iniciais: motivos de impedimento
INSERT INTO public.impedimentos (nome) VALUES
  ('Área não liberada'),
  ('Falta de equipamento'),
  ('Condições climáticas adversas'),
  ('Falta de documentação'),
  ('Equipamento em manutenção'),
  ('Área interditada'),
  ('Falta de pessoal qualificado'),
  ('Conflito de atividades'),
  ('Aguardando inspeção'),
  ('Outros');

-- Dados iniciais: configuração de SLA padrão
INSERT INTO public.sla_config (hora_limite_solicitacao, hora_limite_liberacao, timezone) VALUES
  ('07:30:00', '08:15:00', 'America/Sao_Paulo');

-- Dados iniciais: algumas frentes de serviço
INSERT INTO public.frentes (nome, area) VALUES
  ('Frente A - Montagem', 'Área Industrial'),
  ('Frente B - Tubulação', 'Área Industrial'),
  ('Frente C - Elétrica', 'Área Industrial'),
  ('Frente D - Instrumentação', 'Área Industrial');

-- Dados iniciais: algumas disciplinas
INSERT INTO public.disciplinas (nome) VALUES
  ('Mecânica'),
  ('Elétrica'),
  ('Instrumentação'),
  ('Tubulação'),
  ('Civil'),
  ('Caldeiraria');