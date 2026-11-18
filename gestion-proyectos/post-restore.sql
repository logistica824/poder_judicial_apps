-- ============================================================
-- post-restore.sql — gestion-proyectos
--
-- `supabase db dump` exporta el esquema public pero NO los objetos que la app
-- creó dentro de esquemas administrados por Supabase (auth, storage). Se
-- recrean acá, copiados de las migraciones 0002, 0005 y 0006 del repo.
-- Idempotente: se puede correr más de una vez.
-- ============================================================

-- Endurecimiento (auditoría G-05): las funciones SECURITY DEFINER de public
-- (instanciar_plantilla, recalcular_*, sincronizar_pisos_proyecto, ...) se podían
-- llamar con la anon key sin sesión. Postgres da EXECUTE a PUBLIC por defecto:
-- se quita a PUBLIC y a anon; authenticated y service_role conservan su grant.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- Endurecimiento (relevamiento Cloud S-07): las migraciones 0010 y 0011 dejaron
-- a anon con todos los privilegios sobre notas y reminders. La RLS lo frena,
-- pero el resto de las tablas no tiene grants a anon: se alinean.
revoke all on table public.notas, public.reminders from anon;

-- Alta de perfil al crear usuario (0002_functions.sql).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Buckets (0005_storage.sql + 0006_planos_pdf.sql). Si el dump de datos ya los
-- trajo, sólo se alinea la configuración.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evidencias', 'evidencias', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('planos',     'planos',     false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Políticas de storage.objects (0005_storage.sql).
drop policy if exists "lectura de evidencias" on storage.objects;
create policy "lectura de evidencias"
  on storage.objects for select to authenticated
  using (bucket_id = 'evidencias');

drop policy if exists "subida de evidencias" on storage.objects;
create policy "subida de evidencias"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'evidencias' and owner = auth.uid());

drop policy if exists "borrado de evidencia propia" on storage.objects;
create policy "borrado de evidencia propia"
  on storage.objects for delete to authenticated
  using (bucket_id = 'evidencias' and (owner = auth.uid() or public.is_admin()));

drop policy if exists "lectura de planos" on storage.objects;
create policy "lectura de planos"
  on storage.objects for select to authenticated
  using (bucket_id = 'planos');

drop policy if exists "el admin sube planos" on storage.objects;
create policy "el admin sube planos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'planos' and public.is_admin());

drop policy if exists "el admin borra planos" on storage.objects;
create policy "el admin borra planos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'planos' and public.is_admin());
