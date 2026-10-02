"use server";

import { createAdminClient } from "@clinicalumia/api/admin";
import { requireOwner } from "@clinicalumia/api/auth";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import {
  AFFECTED_APPOINTMENTS_SELECT,
  type AffectedAppointment,
  toAffectedAppointments,
} from "@/lib/affected-appointments";

export type CreateMemberState = { error: string } | { ok: true } | undefined;

export type SetMemberActiveResult =
  | { ok: true }
  | { error: string; appointments?: AffectedAppointment[] };

const HAS_UPCOMING_APPOINTMENTS =
  "Tiene citas pendientes. Muévelas a otra profesional o cancélalas desde el panel y vuelve a intentarlo.";

export async function createMember(
  _prev: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  const owner = await requireOwner(await createClient());
  if (!owner.ok) return { error: owner.error };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const rawSpecialty = String(formData.get("specialty_id") ?? "");
  const specialtyId = rawSpecialty || null;
  const licenseNumber =
    String(formData.get("license_number") ?? "").trim() || null;

  if (!email || !fullName) {
    return { error: "Email y nombre son obligatorios." };
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError || !invited?.user) {
    if (inviteError?.message?.toLowerCase().includes("already")) {
      const { data: patient } = await admin
        .from("patient_accounts")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (patient) {
        return {
          error:
            "Ese email ya tiene una cuenta de paciente. Usa otro email para el equipo.",
        };
      }
      return { error: "Ya hay una cuenta con ese email." };
    }
    return { error: "No se ha podido invitar al miembro." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: invited.user.id,
    email,
    full_name: fullName,
    role: "employee",
    specialty_id: specialtyId,
    license_number: licenseNumber,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return { error: "No se ha podido guardar el perfil." };
  }

  revalidatePath("/team");
  return { ok: true };
}

export async function updateMember(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const specialtyId = String(formData.get("specialty_id") ?? "") || null;
  const licenseNumber =
    String(formData.get("license_number") ?? "").trim() || null;
  if (!fullName) return { error: "El nombre es obligatorio." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      specialty_id: specialtyId,
      license_number: licenseNumber,
    })
    .eq("id", id);
  if (error) return { error: "No se han podido guardar los cambios." };

  revalidatePath("/team");
  return { ok: true };
}

export async function setMemberActive(
  id: string,
  isActive: boolean,
): Promise<SetMemberActiveResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  if (!isActive && id === owner.userId)
    return { error: "No puedes desactivar tu propia cuenta." };

  if (!isActive) {
    const { data: upcoming, error: upcomingError } = await supabase
      .from("appointments")
      .select(AFFECTED_APPOINTMENTS_SELECT)
      .eq("professional_id", id)
      .neq("status", "cancelled")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });
    if (upcomingError || !upcoming)
      return { error: "No se han podido comprobar sus citas pendientes." };
    if (upcoming.length > 0)
      return {
        error: HAS_UPCOMING_APPOINTMENTS,
        appointments: toAffectedAppointments(upcoming),
      };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error?.message === "professional_has_upcoming_appointments")
    return { error: HAS_UPCOMING_APPOINTMENTS };
  if (error) return { error: "No se ha podido cambiar el estado." };

  if (!isActive) {
    const { error: revokeError } = await createAdminClient().rpc(
      "revoke_user_sessions",
      { target: id },
    );
    if (revokeError) {
      revalidatePath("/team");
      return { error: "No se ha podido cerrar sus sesiones abiertas." };
    }
  }

  revalidatePath("/team");
  return { ok: true };
}

export async function resendInvite(email: string): Promise<ActionResult> {
  const owner = await requireOwner(await createClient());
  if (!owner.ok) return { error: owner.error };

  const { error } =
    await createAdminClient().auth.admin.inviteUserByEmail(email);
  if (error) return { error: "No se ha podido reenviar la invitación." };

  revalidatePath("/team");
  return { ok: true };
}

export async function revokeCalendarLink(
  memberId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const { error } = await supabase.rpc("revoke_calendar_token", {
    p_profile_id: memberId,
  });
  if (error) return { error: "No se ha podido invalidar el calendario." };

  return { ok: true };
}

export async function resetTwoFactor(memberId: string): Promise<ActionResult> {
  const owner = await requireOwner(await createClient());
  if (!owner.ok) return { error: owner.error };

  if (memberId === owner.userId) {
    return {
      error: "No puedes restablecer tu propia verificación desde aquí.",
    };
  }

  const admin = createAdminClient();
  const { data, error: listError } = await admin.auth.admin.mfa.listFactors({
    userId: memberId,
  });
  if (listError)
    return { error: "No se ha podido restablecer la verificación." };

  for (const factor of data.factors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: memberId,
    });
    if (deleteError) {
      return { error: "No se ha podido restablecer la verificación." };
    }
  }

  const { error: revokeError } = await admin.rpc("revoke_user_sessions", {
    target: memberId,
  });
  if (revokeError) {
    return { error: "No se ha podido cerrar sus sesiones abiertas." };
  }

  revalidatePath("/team");
  return { ok: true };
}
