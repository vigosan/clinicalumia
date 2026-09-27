const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const CIF_LETTERS = "JABCDEFGHI";

export function normalizeTaxId(input: string): string {
  return input.toUpperCase().replace(/[\s.-]/g, "");
}

function dniLetter(digits: string) {
  return DNI_LETTERS[Number(digits) % 23];
}

function validCif(cif: string) {
  const match = /^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([0-9A-J])$/.exec(cif);
  if (!match) return false;
  const [, letter, digits, control] = match;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const n = Number(digits?.[i]);
    if (i % 2 === 0) {
      const doubled = n * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += n;
    }
  }
  const check = (10 - (sum % 10)) % 10;
  if ("PQRSNW".includes(letter ?? "")) return control === CIF_LETTERS[check];
  if ("ABEH".includes(letter ?? "")) return control === String(check);
  return control === String(check) || control === CIF_LETTERS[check];
}

function isValidDniOrNie(id: string): boolean {
  const dni = /^(\d{8})([A-Z])$/.exec(id);
  if (dni) return dni[2] === dniLetter(dni[1] ?? "");
  const nie = /^([XYZ])(\d{7})([A-Z])$/.exec(id);
  if (nie)
    return (
      nie[3] === dniLetter(`${"XYZ".indexOf(nie[1] ?? "")}${nie[2] ?? ""}`)
    );
  return false;
}

export function isValidPersonalId(input: string): boolean {
  return isValidDniOrNie(normalizeTaxId(input));
}

export function isValidSpanishTaxId(input: string): boolean {
  const id = normalizeTaxId(input);
  return isValidDniOrNie(id) || validCif(id);
}
