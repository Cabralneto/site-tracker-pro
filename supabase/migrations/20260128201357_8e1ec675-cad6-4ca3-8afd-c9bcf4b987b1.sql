-- Drop existing update policy
DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil" ON public.profiles;

-- Create new policy that allows admin to update any profile
CREATE POLICY "Usuários podem atualizar próprio perfil ou admin pode atualizar qualquer"
ON public.profiles
FOR UPDATE
USING (id = auth.uid() OR is_admin(auth.uid()))
WITH CHECK (id = auth.uid() OR is_admin(auth.uid()));