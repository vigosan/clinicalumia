insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exports', 'exports', false, 52428800, array['application/zip'])
on conflict (id) do nothing;

create policy "exports_select_owner" on storage.objects
  for select to authenticated
  using (bucket_id = 'exports' and public.is_owner() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "exports_insert_owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'exports' and public.is_owner() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "exports_delete_owner" on storage.objects
  for delete to authenticated
  using (bucket_id = 'exports' and public.is_owner() and (storage.foldername(name))[1] = auth.uid()::text);
