export type Ward = {
  name: string;
  relationship: "madre" | "padre" | "tutor_legal" | "otro";
};

const RELATIONSHIP_LABEL: Record<Ward["relationship"], string> = {
  madre: "madre de",
  padre: "padre de",
  tutor_legal: "tutor legal de",
  otro: "tutor/a de",
};

export function wardsLabel(wards: Ward[]): string {
  const order: Ward["relationship"][] = [];
  const namesByRelationship = new Map<Ward["relationship"], string[]>();
  for (const ward of wards) {
    if (!namesByRelationship.has(ward.relationship)) {
      order.push(ward.relationship);
      namesByRelationship.set(ward.relationship, []);
    }
    namesByRelationship.get(ward.relationship)?.push(ward.name);
  }
  return order
    .map(
      (relationship) =>
        `${RELATIONSHIP_LABEL[relationship]} ${namesByRelationship.get(relationship)?.join(", ")}`,
    )
    .join(" y ");
}
