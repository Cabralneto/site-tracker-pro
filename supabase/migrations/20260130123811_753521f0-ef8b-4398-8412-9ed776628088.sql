-- =====================================================
-- CORREÇÃO COMPLETA: profiles com dados sensíveis + diretório público
-- =====================================================

-- -----------------------------------------------------
-- PRÉ: garantir RLS em profiles
-- -----------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- FASE 1: Remover policies permissivas antigas
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Usuários podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "User can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "User can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "User can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil ou admin pode atualiz" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem inserir próprio perfil" ON public.profiles;

-- -----------------------------------------------------
-- FASE 2: Policies seguras para profiles (sensível)
-- -----------------------------------------------------

-- SELECT: usuário vê apenas o próprio perfil
CREATE POLICY "User can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- SELECT: admin vê todos os perfis
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- INSERT: usuário só pode inserir o próprio perfil
CREATE POLICY "User can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));

-- UPDATE: usuário só pode atualizar o próprio perfil
CREATE POLICY "User can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- UPDATE: admin pode atualizar qualquer perfil
CREATE POLICY "Admin can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- -----------------------------------------------------
-- FASE 3: Criar tabela profiles_directory (público)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles_directory (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL
);

ALTER TABLE public.profiles_directory ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas, se existirem
DROP POLICY IF EXISTS "Authenticated can view directory" ON public.profiles_directory;

-- SELECT: qualquer autenticado pode ver o diretório
CREATE POLICY "Authenticated can view directory"
ON public.profiles_directory
FOR SELECT
TO authenticated
USING (true);

-- Garantir que não existe escrita pelo client
REVOKE INSERT, UPDATE, DELETE ON public.profiles_directory FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.profiles_directory FROM authenticated;
GRANT SELECT ON public.profiles_directory TO authenticated;

-- -----------------------------------------------------
-- FASE 4: Função de sincronização (trigger) com SECURITY DEFINER
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profiles_directory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profiles_directory (id, nome)
    VALUES (NEW.id, NEW.nome)
    ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.profiles_directory
    SET nome = NEW.nome
    WHERE id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.profiles_directory
    WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trancar execução manual da função
REVOKE ALL ON FUNCTION public.sync_profiles_directory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profiles_directory() FROM authenticated;

-- Criar/atualizar trigger
DROP TRIGGER IF EXISTS trigger_sync_profiles_directory ON public.profiles;

CREATE TRIGGER trigger_sync_profiles_directory
AFTER INSERT OR UPDATE OF nome OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profiles_directory();

-- -----------------------------------------------------
-- FASE 5: Backfill (popular/atualizar diretório com o que já existe)
-- -----------------------------------------------------
INSERT INTO public.profiles_directory (id, nome)
SELECT id, nome FROM public.profiles
ON CONFLICT (id) DO UPDATE
SET nome = EXCLUDED.nome;