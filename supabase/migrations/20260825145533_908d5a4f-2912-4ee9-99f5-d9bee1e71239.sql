-- 1) Remove objetos dependentes do enum antigo
DROP POLICY IF EXISTS "Admins gerenciam cargos" ON public.user_roles;
DROP POLICY IF EXISTS "Admins veem todos os cargos" ON public.user_roles;
DROP POLICY IF EXISTS "Admins veem todos os perfis" ON public.profiles;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 2) Novo enum de hierarquia
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('founder', 'c_level', 'direcao', 'manager', 'staff');

ALTER TABLE public.user_roles ALTER COLUMN role TYPE text;
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING (
  CASE role
    WHEN 'admin' THEN 'founder'
    WHEN 'dev' THEN 'staff'
    ELSE 'staff'
  END::public.app_role
);
DROP TYPE public.app_role_old;

-- 3) Recria funções de verificação
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_founder(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'founder'::public.app_role)
$$;
REVOKE EXECUTE ON FUNCTION public.is_founder(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_founder(uuid) TO authenticated;

-- 4) Policies atualizadas
CREATE POLICY "Founder gerencia cargos" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Founder ve todos os perfis" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));
CREATE POLICY "Gestao ve todos os perfis" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'c_level') OR public.has_role(auth.uid(), 'direcao'));

-- 5) Tabela de permissões por categoria
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, category)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem permissoes" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Founder gerencia permissoes" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

-- 6) Permissões padrão
INSERT INTO public.role_permissions (role, category) VALUES
  ('c_level','avisos'),('c_level','itens'),('c_level','comandos'),('c_level','carros'),('c_level','ilegal'),('c_level','desenvolvimento'),('c_level','usuarios'),('c_level','configuracoes'),
  ('direcao','avisos'),('direcao','itens'),('direcao','comandos'),('direcao','carros'),('direcao','ilegal'),('direcao','desenvolvimento'),('direcao','configuracoes'),
  ('manager','avisos'),('manager','itens'),('manager','comandos'),('manager','carros'),('manager','ilegal'),
  ('staff','avisos'),('staff','comandos');