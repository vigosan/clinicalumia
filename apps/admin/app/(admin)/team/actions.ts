"use server";

import { createAdminClient } from "@clinicalumia/api/admin";
import { requireOwner } from "@clinicalumia/api/auth";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";

export type CreateMemberState = { error: string } | { ok: true } | undefined;

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
): Promise<ActionResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  if (!isActive && id === owner.userId)
    return { error: "No puedes desactivar tu propia cuenta." };

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", id);
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
