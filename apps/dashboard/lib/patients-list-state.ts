export type PatientsListState = "error" | "empty" | "list";

export function patientsListState(
  hasError: boolean,
  rowCount: number,
): PatientsListState {
  if (hasError) return "error";
  if (rowCount === 0) return "empty";
  return "list";
}
