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
        onChange={(event) =>
          router.push(`/schedules?employee=${event.target.value}`)
        }
      >
        {employees.map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.full_name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
