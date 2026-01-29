-- Adicionar novos campos na tabela pts
ALTER TABLE public.pts 
ADD COLUMN IF NOT EXISTS efetivo_qtd integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS encarregado_nome text,
ADD COLUMN IF NOT EXISTS encarregado_matricula text,
ADD COLUMN IF NOT EXISTS descricao_operacao text,
ADD COLUMN IF NOT EXISTS causa_atraso text,
ADD COLUMN IF NOT EXISTS atraso_etm numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS atraso_petrobras numeric DEFAULT 0;

-- Criar índice para busca por encarregado
CREATE INDEX IF NOT EXISTS idx_pts_encarregado ON public.pts(encarregado_nome);

-- Comentários para documentação
COMMENT ON COLUMN public.pts.efetivo_qtd IS 'Quantidade de efetivo na operação';
COMMENT ON COLUMN public.pts.encarregado_nome IS 'Nome do encarregado responsável';
COMMENT ON COLUMN public.pts.encarregado_matricula IS 'Matrícula do encarregado';
COMMENT ON COLUMN public.pts.descricao_operacao IS 'Descrição detalhada da operação';
COMMENT ON COLUMN public.pts.causa_atraso IS 'Causa do atraso (obrigatório quando houver atraso)';
COMMENT ON COLUMN public.pts.atraso_etm IS 'Tempo de atraso ETM em minutos';
COMMENT ON COLUMN public.pts.atraso_petrobras IS 'Tempo de atraso Petrobras em minutos';