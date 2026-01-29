-- Alterar tabela pts para suportar múltiplas frentes e disciplinas
-- Adicionar colunas de array para armazenar múltiplos IDs
ALTER TABLE public.pts 
ADD COLUMN IF NOT EXISTS frente_ids uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS disciplina_ids uuid[] DEFAULT '{}';

-- Migrar dados existentes para os novos campos de array
UPDATE public.pts 
SET frente_ids = CASE WHEN frente_id IS NOT NULL THEN ARRAY[frente_id] ELSE '{}' END,
    disciplina_ids = CASE WHEN disciplina_id IS NOT NULL THEN ARRAY[disciplina_id] ELSE '{}' END
WHERE frente_ids = '{}' OR disciplina_ids = '{}';

-- Comentários para documentação
COMMENT ON COLUMN public.pts.frente_ids IS 'Array de IDs das frentes de serviço selecionadas';
COMMENT ON COLUMN public.pts.disciplina_ids IS 'Array de IDs das disciplinas selecionadas';