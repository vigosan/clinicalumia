"use server";

import { isUuid } from "@/lib/agenda";
import {
  type AppointmentDetailResult,
  loadAppointmentDetail,
} from "./load-detail";

export async function fetchAppointmentDetail(
  id: string,
): Promise<AppointmentDetailResult> {
  if (!isUuid(id)) return { status: "none" };
  return loadAppointmentDetail(id);
}
