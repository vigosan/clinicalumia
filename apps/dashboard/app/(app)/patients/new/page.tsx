import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { PersonForm } from "../PersonForm";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ guardianOf?: string }>;
}) {
  const { guardianOf } = await searchParams;
  const minorId = guardianOf && UUID_REGEX.test(guardianOf) ? guardianOf : null;

  let guardianOfProp: { id: string; minorName: string } | undefined;
  if (minorId) {
    const supabase = await createClient();
    const { data: minor } = await supabase
      .from("people")
      .select("first_name, last_name")
      .eq("id", minorId)
      .maybeSingle();
    if (minor) {
      guardianOfProp = {
        id: minorId,
        minorName: `${minor.first_name} ${minor.last_name}`,
      };
    }
  }

  return (
    <>
      <PageHeader
        title="Nueva persona"
        description={
          guardianOfProp ? `Tutor de ${guardianOfProp.minorName}` : undefined
        }
      />
      <Card>
        <PersonForm guardianOf={guardianOfProp} />
      </Card>
    </>
  );
}
