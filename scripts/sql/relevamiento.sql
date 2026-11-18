-- Relevamiento de un proyecto Supabase Cloud (sólo lectura).
\pset footer off

\echo '== Versión de Postgres =='
select version();

\echo '== Tablas en public (filas estimadas) =='
select relname as tabla, n_live_tup as filas_aprox
from pg_stat_user_tables where schemaname = 'public' order by relname;

\echo '== Funciones en public =='
select p.proname as funcion, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by 1;

\echo '== Triggers sobre auth.users / storage.objects (no los exporta db dump) =='
select event_object_schema || '.' || event_object_table as tabla, trigger_name, action_statement
from information_schema.triggers
where event_object_schema in ('auth', 'storage') order by 1, 2;

\echo '== RLS y políticas (public y storage) =='
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public', 'storage') order by 1, 2, 3;

\echo '== Tablas de public con RLS desactivada =='
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1;

\echo '== Privilegios de anon / authenticated en public =='
select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by 1, 2 order by 2, 1;

\echo '== Publicación supabase_realtime =='
select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 2;

\echo '== Extensiones =='
select extname, extversion from pg_extension order by 1;

\echo '== Auth: usuarios por provider =='
select provider, count(*) from auth.identities group by 1 order by 1;
select count(*) as usuarios_totales, max(last_sign_in_at) as ultimo_login from auth.users;

\echo '== Storage: buckets =='
select b.id, b.public, b.file_size_limit, b.allowed_mime_types,
       count(o.id) as objetos,
       pg_size_pretty(coalesce(sum((o.metadata->>'size')::bigint), 0)) as tamano
from storage.buckets b left join storage.objects o on o.bucket_id = b.id
group by 1, 2, 3, 4 order by 1;

\echo '== SEGURIDAD: usuarios, proveedor de login y rol (ver docs/AUDITORIA-SEGURIDAD.md G-01/H-01) =='
\echo '   gestion: un admin que nadie dio de alta puede venir de un signup con {"rol":"admin"}.'
\echo '   horas: una identidad con provider "email" no debería existir (sólo Google).'
select u.email, string_agg(distinct i.provider, ',') as proveedores, p.rol, p.activo,
       u.raw_user_meta_data ->> 'rol' as rol_pedido_en_signup, u.created_at, u.last_sign_in_at
from auth.users u
left join auth.identities i on i.user_id = u.id
left join public.profiles p on p.id = u.id
group by u.id, u.email, p.rol, p.activo, u.created_at, u.last_sign_in_at
order by p.rol nulls last, u.created_at;

\echo '== SEGURIDAD (horas): whitelist con super_admin o fuera del dominio del PJ (H-03) =='
select email, rol, activo from public.allowed_emails
where rol = 'super_admin' or email not ilike '%@justiciacordoba.gob.ar' order by rol, email;

\echo '== SEGURIDAD (horas): perfiles cuyo email no coincide con su cuenta (H-02) =='
select p.email as email_perfil, u.email as email_cuenta, p.activo
from public.profiles p join auth.users u on u.id = p.id
where lower(p.email) is distinct from lower(u.email);

\echo '== Tamaño de la base =='
select pg_size_pretty(pg_database_size(current_database()));
