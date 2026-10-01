"use client";

import { Field } from "@clinicalumia/ui/field";
import { Select } from "@clinicalumia/ui/select";
import { useRouter } from "next/navigation";

type Employee = { id: string; full_name: string };

export function EmployeePicker({
  employees,
  selectedId,
}: {
  employees: Employee[];
  selectedId: string;
}) {
  const router = useRouter();

  return (
    <Field label="Persona del equipo">
      <Select
        data-testid="schedule-employee"
        value={selectedId}
        onValueChange={(value) => router.push(`/schedules?employee=${value}`)}
        options={employees.map((employee) => ({
          value: employee.id,
          label: employee.full_name,
        }))}
      />
    </Field>
  );
}
