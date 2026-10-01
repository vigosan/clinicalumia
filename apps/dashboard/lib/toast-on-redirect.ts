import { toast } from "@clinicalumia/ui/toast";

function redirectLocation(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("digest" in error))
    return null;
  const { digest } = error;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT;"))
    return null;
  return digest.split(";").slice(2, -2).join(";");
}

export function toastOnRedirect<State>(
  action: (state: State, formData: FormData) => Promise<State>,
  message: string | ((location: string) => string | null),
) {
  return async (state: State, formData: FormData): Promise<State> => {
    try {
      return await action(state, formData);
    } catch (error) {
      const location = redirectLocation(error);
      const text =
        location === null
          ? null
          : typeof message === "string"
            ? message
            : message(location);
      if (text) toast(text);
      throw error;
    }
  };
}
