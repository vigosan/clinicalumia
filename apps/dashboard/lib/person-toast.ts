export function newPersonToast(
  location: string,
  guardianOfId?: string,
): string {
  if (location.includes("guardianError=") || location.includes("linkError="))
    return "Ficha creada";
  if (location.startsWith("/consentimientos/"))
    return "Ficha creada y consentimiento asociado";
  if (guardianOfId && location === `/patients/${guardianOfId}`)
    return "Tutor/a añadido/a";
  return "Ficha creada";
}
