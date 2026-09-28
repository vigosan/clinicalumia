import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { PersonForm } from "../PersonForm";

export default function NewPersonPage() {
  return (
    <>
      <PageHeader title="Nueva persona" />
      <Card>
        <PersonForm />
      </Card>
    </>
  );
}
