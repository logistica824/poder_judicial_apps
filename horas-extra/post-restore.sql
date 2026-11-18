-- ============================================================
-- post-restore.sql — horas-extra
--
-- `supabase db dump` no exporta el trigger que la app creó sobre auth.users ni
-- la membresía de la publicación supabase_realtime. Se recrean acá, tal como
-- están en 0001_schema_inicial.sql y 0003_tareas_por_dia.sql. Idempotente.
-- ============================================================

-- Endurecimiento (auditoría): ninguna función de public tiene que poder
-- llamarse sin sesión. Postgres da EXECUTE a PUBLIC por defecto: se quita a
-- PUBLIC y a anon; authenticated y service_role conservan su grant.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Alta de profile desde la whitelist al primer login (0001).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tablas que escucha el front con postgres_changes (Calendario / AdminPanel).
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array[
    'signups', 'day_descriptions', 'board_columns', 'board_column_members',
    'cancellation_requests', 'tareas', 'tarea_asignaciones'
  ] loop
    if to_regclass('public.' || t) is not null and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
