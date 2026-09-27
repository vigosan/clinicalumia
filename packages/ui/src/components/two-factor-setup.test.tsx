import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, type Mock, vi } from "vitest";
import { type TwoFactorFormState, TwoFactorSetup } from "./two-factor-setup";

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
    // biome-ignore lint/performance/noImgElement: test double for next/image
    <img src={typeof src === "string" ? src : src.src} alt={alt} {...props} />
  ),
}));

type Action = Mock<
  (state: TwoFactorFormState, formData: FormData) => Promise<TwoFactorFormState>
>;

function renderSetup(action: Action = vi.fn(async () => undefined)) {
  render(
    <TwoFactorSetup
      qrCode="data:image/svg+xml;utf-8,<svg/>"
      secret="JBSWY3DPEHPK3PXP"
      factorId="factor-1"
      action={action}
    />,
  );
  return action;
}

describe("TwoFactorSetup", () => {
  it("shows the secret to type by hand, for when the QR can't be scanned", () => {
    renderSetup();
    expect(screen.getByTestId("totp-secret")).toHaveTextContent(
      "JBSWY3DPEHPK3PXP",
    );
  });

  it("shows the QR with alt text describing it to screen reader users", () => {
    renderSetup();
    expect(
      screen.getByAltText("Código QR para tu app de autenticación"),
    ).toBeInTheDocument();
  });

  it("labels the code field for a 6-digit, one-time code from an authenticator app", () => {
    renderSetup();
    const input = screen.getByLabelText("Código de 6 dígitos");
    expect(input).toHaveAttribute("inputMode", "numeric");
    expect(input).toHaveAttribute("autoComplete", "one-time-code");
  });

  it("sends the typed code together with the factor id being confirmed", async () => {
    const action = renderSetup();
    await userEvent.type(screen.getByTestId("totp-code"), "123456");
    await userEvent.click(screen.getByTestId("totp-submit"));

    const formData = action.mock.calls[0]![1];
    expect(formData.get("code")).toBe("123456");
    expect(formData.get("factorId")).toBe("factor-1");
  });

  it("announces a wrong code as an alert, so screen reader users hear it", async () => {
    const action = renderSetup(
      vi.fn(async () => ({
        error:
          "El código no es correcto o ha caducado. Prueba con el siguiente.",
      })),
    );
    await userEvent.type(screen.getByTestId("totp-code"), "000000");
    await userEvent.click(screen.getByTestId("totp-submit"));

    const alert = await screen.findByTestId("totp-error");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent(
      "El código no es correcto o ha caducado. Prueba con el siguiente.",
    );
    expect(action).toHaveBeenCalledOnce();
  });
});
