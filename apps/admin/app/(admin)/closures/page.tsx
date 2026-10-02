import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { monthFromParam } from "@/lib/closures";
import { AddClosure } from "./AddClosure";
import { ClosuresCalendar } from "./ClosuresCalendar";

export default async function ClosuresPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: param } = await searchParams;
  const supabase = await createClient();
  const { data: closures } = await supabase
    .from("clinic_closures")
    .select("id, starts_on, ends_on, reason");
  const today = todayInMadrid();
  const month = monthFromParam(param, today);

  return (
    <>
      <PageHeader
        title="Días de cierre"
        description="Días en que la clínica no abre. La web no ofrece huecos esos días y las citas que ya hay no se cancelan."
        actions={<AddClosure today={today} />}
      />
      <ClosuresCalendar
        key={month}
        month={month}
        closures={closures ?? []}
        today={today}
      />
    </>
  );
}
