create or replace function public.next_invoice_number(p_series public.invoice_series_code, p_issued_at timestamptz)
returns table (invoice_number integer, invoice_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_year integer := extract(year from p_issued_at at time zone 'Europe/Madrid')::integer;
  series public.invoice_series;
begin
  insert into public.invoice_series (code, year, format, configured)
  select p_series, invoice_year, s.format, s.configured
  from public.invoice_series s
  where s.code = p_series
  order by s.year <= invoice_year desc, s.year desc
  limit 1
  on conflict (code, year) do nothing;
  select * into series
  from public.invoice_series s
  where s.code = p_series and s.year = invoice_year
  for update;
  if not series.configured then
    if p_series = 'rectifying' then
      raise exception 'rectifying_series_not_configured' using errcode = 'P0001';
    end if;
    raise exception 'invoice_series_not_configured' using errcode = 'P0001';
  end if;
  update public.invoice_series s
  set next_number = series.next_number + 1,
      locked = true
  where s.code = p_series and s.year = invoice_year;
  return query select series.next_number, public.format_invoice_code(series.format, invoice_year, series.next_number);
end;
$$;

revoke all on function public.next_invoice_number(public.invoice_series_code, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.clinic_invoice_header(p_require_address boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  settings public.clinic_settings;
  missing text[];
begin
  select * into settings from public.clinic_settings;
  missing := array_remove(array[
    case when btrim(settings.legal_name) = '' then 'legal_name' end,
    case when btrim(settings.tax_id) = '' then 'tax_id' end,
    case when p_require_address and btrim(settings.address_line) = '' then 'address_line' end,
    case when p_require_address and btrim(settings.postal_code) = '' then 'postal_code' end,
    case when p_require_address and btrim(settings.city) = '' then 'city' end
  ], null);
  if cardinality(missing) > 0 then
    raise exception 'clinic_fiscal_data_missing' using errcode = 'P0001', detail = array_to_string(missing, ',');
  end if;
  return jsonb_build_object(
    'issuer', jsonb_build_object(
      'name', btrim(settings.legal_name),
      'tax_id', upper(btrim(settings.tax_id)),
      'address_line', settings.address_line,
      'postal_code', settings.postal_code,
      'city', settings.city,
      'province', settings.province,
      'phone', settings.phone,
      'email', settings.email,
      'website', settings.website
    ),
    'footer', settings.invoice_footer
  );
end;
$$;

revoke all on function public.clinic_invoice_header(boolean) from public, anon, authenticated, service_role;
