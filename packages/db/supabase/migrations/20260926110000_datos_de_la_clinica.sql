create table public.clinic_settings (
  id boolean primary key default true check (id),
  legal_name text not null default '',
  tax_id text not null default '',
  address_line text not null default '',
  postal_code text not null default '',
  city text not null default '',
  province text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  logo_path text,
  vat_exemption_text text not null default 'Operación exenta de IVA según el artículo 20.Uno.3º de la Ley 37/1992, del Impuesto sobre el Valor Añadido.',
  invoice_footer text not null default '',
  invoice_prefix text not null default '',
  rectifying_prefix text not null default 'R',
  cancellation_hours integer not null default 24 check (cancellation_hours between 0 and 720),
  timezone text not null default 'Europe/Madrid',
  updated_at timestamptz not null default now()
);

insert into public.clinic_settings (id) values (true);

create trigger clinic_settings_touch
  before update on public.clinic_settings
  for each row execute function public.touch_updated_at();

alter table public.clinic_settings enable row level security;

create policy "clinic_settings_select_active_staff" on public.clinic_settings
  for select to authenticated using (public.is_active_staff());
create policy "clinic_settings_update_owner" on public.clinic_settings
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "branding_insert_owner" on storage.objects
  for insert to authenticated with check (bucket_id = 'branding' and public.is_owner());
create policy "branding_update_owner" on storage.objects
  for update to authenticated using (bucket_id = 'branding' and public.is_owner()) with check (bucket_id = 'branding' and public.is_owner());
create policy "branding_delete_owner" on storage.objects
  for delete to authenticated using (bucket_id = 'branding' and public.is_owner());
