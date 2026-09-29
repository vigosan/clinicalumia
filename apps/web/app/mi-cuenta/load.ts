import { addDays } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import type { AppointmentRow } from "@/lib/account";
import type { Slot } from "@/lib/booking";
import { type AccountPerson, WINDOW_DAYS } from "../reservar/step";

export type AccountContact = {
  personId: string;
  name: string;
  phone: string | null;
  address: string;
};

export type Account = {
  appointments: AppointmentRow[];
  people: AccountPerson[];
  contacts: AccountContact[];
};

export async function loadAccount(): Promise<Account> {
  const supabase = await createClient();
  const [appointments, people] = await Promise.all([
    supabase.rpc("my_appointments"),
    supabase.rpc("my_people"),
  ]);
  if (appointments.error) throw appointments.error;
  if (people.error) throw people.error;

  const adults = people.data.filter(
    (person) => person.relation === "self" && !person.is_minor,
  );
  const contacts = await Promise.all(
    adults.map(async (person) => {
      const { data, error } = await supabase.rpc("my_contact", {
        p_person_id: person.id,
      });
      if (error) throw error;
      return {
        personId: person.id,
        name: `${person.first_name} ${person.last_name}`,
        phone: data[0]?.phone ?? null,
        address: data[0]?.address ?? "",
      };
    }),
  );

  return { appointments: appointments.data, people: people.data, contacts };
}

export async function loadRescheduleSlots(
  appointmentId: string,
  from: string,
): Promise<Slot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_reschedule_slots", {
    p_appointment_id: appointmentId,
    p_from: from,
    p_to: addDays(from, WINDOW_DAYS - 1),
  });
  if (error) throw error;
  return data;
}
