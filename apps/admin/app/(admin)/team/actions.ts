"use server";

import { createAdminClient } from "@clinicalumia/api/admin";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";

export type CreateMemberState = { error: string } | { ok: true } | undefined;

export async function createMember(
  _prev: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const rawSpecialty = String(formData.get("specialty_id") ?? "");
  const specialtyId = rawSpecialty || null;

  if (!email || !fullName) {
    return { error: "Email y nombre son obligatorios." };
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError || !invited?.user) {
    if (inviteError?.message?.toLowerCase().includes("already")) {
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
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(invited.user.id);
    return { error: "No se ha podido guardar el perfil." };
  }

  revalidatePath("/team");
  return { ok: true };
}

export async function updateMember(id: string, formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const rawSpecialty = String(formData.get("specialty_id") ?? "");
  const specialtyId = rawSpecialty || null;

  if (!fullName) return;

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ full_name: fullName, specialty_id: specialtyId })
    .eq("id", id);

  revalidatePath("/team");
}

export async function setMemberActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/team");
}

export async function resendInvite(email: string) {
  const admin = createAdminClient();
  await admin.auth.admin.inviteUserByEmail(email);
  revalidatePath("/team");
}
