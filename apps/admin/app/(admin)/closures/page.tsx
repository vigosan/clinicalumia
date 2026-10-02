import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { EmptyState } from "@clinicalumia/ui/empty-state";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { splitClosures } from "@/lib/closures";
import { AddClosure } from "./AddClosure";
import { ClosureRow } from "./ClosureRow";

export default async function ClosuresPage() {
  const supabase = await createClient();
  const { data: closures } = await supabase
    .from("clinic_closures")
    .select("id, starts_on, ends_on, reason");
  const today = todayInMadrid();
  const { upcoming, past } = splitClosures(closures ?? [], today);

  return (
    <>
      <PageHeader
        title="Días de cierre"
        description="Días en que la clínica no abre. La web no ofrece huecos esos días y las citas que ya hay no se cancelan."
        actions={<AddClosure today={today} />}
      />
      {upcoming.length > 0 ? (
        <Card className="p-2">
          <ul>
            {upcoming.map((closure) => (
              <ClosureRow key={closure.id} closure={closure} />
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="No hay cierres previstos." />
      )}
      {past.length > 0 && (
        <details data-testid="closures-past">
          <summary className="cursor-pointer text-[15px] font-medium text-ink-900">
            Cierres anteriores
          </summary>
          <Card className="mt-3 p-2">
            <ul>
              {past.map((closure) => (
                <ClosureRow key={closure.id} closure={closure} />
              ))}
            </ul>
          </Card>
        </details>
      )}
    </>
  );
}
