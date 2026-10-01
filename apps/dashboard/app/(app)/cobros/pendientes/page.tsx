import { redirect } from "next/navigation";

export default function PendingPaymentsPage() {
  redirect("/cobros?tab=pendientes");
}
