-- Supabase's optional automatic-RLS event trigger creates this helper.
-- Only its owner needs to execute it; public clients must not call it.
begin;
do $restrict$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$restrict$;
commit;
