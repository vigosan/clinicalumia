import type { SignatureMethod } from "./consent";

export type SignatureChoice = {
  method: SignatureMethod;
  typedName: string;
  edited: boolean;
};

export type SignatureEvent =
  | { type: "method"; method: SignatureMethod }
  | { type: "signer"; firstName: string; lastName: string; guardian: string }
  | { type: "typedName"; value: string };

export const initialSignatureChoice: SignatureChoice = {
  method: "drawn",
  typedName: "",
  edited: false,
};

export function signatureChoice(
  state: SignatureChoice,
  event: SignatureEvent,
): SignatureChoice {
  switch (event.type) {
    case "method":
      return { ...state, method: event.method };
    case "typedName":
      return { ...state, typedName: event.value, edited: true };
    case "signer": {
      if (state.edited) return state;
      const signer =
        event.guardian.trim() ||
        `${event.firstName.trim()} ${event.lastName.trim()}`.trim();
      return { ...state, typedName: signer };
    }
  }
}
