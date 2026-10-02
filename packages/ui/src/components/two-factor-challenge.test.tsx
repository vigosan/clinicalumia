import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, type Mock, vi } from "vitest";
import {
  TwoFactorChallenge,
  type TwoFactorFormState,
} from "./two-factor-challenge";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    priority: _priority,
    unoptimized: _unoptimized,
    ...props
  }: {
    src: string | { src: string };
    alt: string;
    priority?: boolean;
    unoptimized?: boolean;
  } & Record<string, unknown>) => (
    <img src={typeof src === "string" ? src : src.src} alt={alt} {...props} />
  ),
}));

type Action = Mock<
  (state: TwoFactorFormState, formData: FormData) => Promise<TwoFactorFormState>
>;

function renderChallenge({
  action = vi.fn(async () => undefined),
  logoutAction = vi.fn(async () => undefined),
  owner = false,
}: {
  action?: Action;
  logoutAction?: () => Promise<void>;
  owner?: boolean;
} = {}) {
  render(
    <TwoFactorChallenge
      action={action}
      next="/pacientes"
      logoutAction={logoutAction}
      owner={owner}
    />,
  );
  return { action, logoutAction };
}

describe("TwoFactorChallenge", () => {
  it("labels the code field for a 6-digit, one-time code from an authenticator app", () => {
    renderChallenge();
    const input = screen.getByLabelText("Código de 6 dígitos");
    expect(input).toHaveAttribute("inputMode", "numeric");
    expect(input).toHaveAttribute("autoComplete", "one-time-code");
  });

  it("helps a locked-out person ask for a reset without assuming they are the owner", () => {
    renderChallenge();
    expect(
      screen.getByText(
        "¿Has perdido el móvil? Pide que restablezcan tu verificación.",
      ),
    ).toBeInTheDocument();
  });

  it("sends the owner to technical support, since nobody in the clinic can reset her verification", () => {
    renderChallenge({ owner: true });
    expect(
      screen.getByText(
        "Si has perdido el móvil, contacta con el soporte técnico para restablecer la verificación.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "¿Has perdido el móvil? Pide que restablezcan tu verificación.",
      ),
    ).not.toBeInTheDocument();
  });

  it("sends the typed code and the destination to return to once verified", async () => {
    const { action } = renderChallenge();
    await userEvent.type(screen.getByTestId("totp-code"), "123456");
    await userEvent.click(screen.getByTestId("totp-submit"));

    const formData = action.mock.calls[0]![1];
    expect(formData.get("code")).toBe("123456");
    expect(formData.get("next")).toBe("/pacientes");
  });

  it("announces a wrong code as an alert, so screen reader users hear it", async () => {
    const { action } = renderChallenge({
      action: vi.fn(async () => ({
        error:
          "El código no es correcto o ha caducado. Prueba con el siguiente.",
      })),
    });
    await userEvent.type(screen.getByTestId("totp-code"), "000000");
    await userEvent.click(screen.getByTestId("totp-submit"));

    const alert = await screen.findByTestId("totp-error");
    expect(alert).toHaveAttribute("role", "alert");
    expect(action).toHaveBeenCalledOnce();
  });

  it("signs the user out when they can't complete the second step", async () => {
    const { logoutAction } = renderChallenge();
    await userEvent.click(screen.getByTestId("totp-logout"));
    expect(logoutAction).toHaveBeenCalledOnce();
  });
});
