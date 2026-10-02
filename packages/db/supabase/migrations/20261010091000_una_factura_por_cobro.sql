create unique index invoices_one_original_per_payment on public.invoices(payment_id)
  where kind <> 'rectifying' and replaces_invoice_id is null;

drop index public.invoices_one_simplified_per_payment;
