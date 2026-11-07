ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_moderator' AFTER 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contributor' AFTER 'support';