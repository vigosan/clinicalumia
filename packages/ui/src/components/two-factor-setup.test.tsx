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
    <img src={typeof src === "string" ? src : src.src} alt={alt} {...props} />
  ),
}));

type ConfirmAction = Mock<
  (state: TwoFactorFormState, formData: FormData) => Promise<TwoFactorFormState>
>;
type StartAction = Mock<
  () => Promise<
    { factorId: string; qrCode: string; secret: string } | { error: string }
  >
>;

const enrollment = {
  factorId: "factor-1",
  qrCode: "data:image/svg+xml;utf-8,<svg/>",
  secret: "JBSWY3DPEHPK3PXP",
};

function renderSetup({
  startAction = vi.fn(async () => enrollment),
  confirmAction = vi.fn(async () => undefined),
  logoutAction = vi.fn(async () => undefined),
}: {
  startAction?: StartAction;
  confirmAction?: ConfirmAction;
  logoutAction?: () => Promise<void>;
} = {}) {
  render(
    <TwoFactorSetup
      startAction={startAction}
      confirmAction={confirmAction}
      logoutAction={logoutAction}
    />,
  );
  return { startAction, confirmAction, logoutAction };
}

async function start() {
  await userEvent.click(screen.getByTestId("totp-start"));
  await screen.findByTestId("totp-secret");
}

describe("TwoFactorSetup", () => {
  it("signs the person out when they can't finish enrolling", async () => {
    const { logoutAction } = renderSetup();
    await userEvent.click(screen.getByTestId("totp-logout"));
    expect(logoutAction).toHaveBeenCalledOnce();
  });

  it("does not enroll until the person asks to start, so opening the page never burns a factor", () => {
    const { startAction } = renderSetup();
    expect(startAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId("totp-secret")).not.toBeInTheDocument();
  });

  it("shows the secret to type by hand, for when the QR can't be scanned", async () => {
    renderSetup();
    await start();
    expect(screen.getByTestId("totp-secret")).toHaveTextContent(
      "JBSWY3DPEHPK3PXP",
    );
  });

  it("shows the QR with alt text describing it to screen reader users", async () => {
    renderSetup();
    await start();
    expect(
      screen.getByAltText("Código QR para tu app de autenticación"),
    ).toBeInTheDocument();
  });

  it("labels the code field for a 6-digit, one-time code from an authenticator app", async () => {
    renderSetup();
    await start();
    const input = screen.getByLabelText("Código de 6 dígitos");
    expect(input).toHaveAttribute("inputMode", "numeric");
    expect(input).toHaveAttribute("autoComplete", "one-time-code");
  });

  it("sends the typed code together with the factor id being confirmed", async () => {
    const { confirmAction } = renderSetup();
    await start();
    await userEvent.type(screen.getByTestId("totp-code"), "123456");
    await userEvent.click(screen.getByTestId("totp-submit"));

    const formData = confirmAction.mock.calls[0]![1];
    expect(formData.get("code")).toBe("123456");
    expect(formData.get("factorId")).toBe("factor-1");
  });

  it("announces a wrong code as an alert, so screen reader users hear it", async () => {
    const { confirmAction } = renderSetup({
      confirmAction: vi.fn(async () => ({
        error:
          "El código no es correcto o ha caducado. Prueba con el siguiente.",
      })),
    });
    await start();
    await userEvent.type(screen.getByTestId("totp-code"), "000000");
    await userEvent.click(screen.getByTestId("totp-submit"));

    const alert = await screen.findByTestId("totp-error");
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent(
      "El código no es correcto o ha caducado. Prueba con el siguiente.",
    );
    expect(confirmAction).toHaveBeenCalledOnce();
  });

  it("keeps the same secret and factor id after a wrong code, instead of re-enrolling a new one", async () => {
    const confirmAction: ConfirmAction = vi
      .fn()
      .mockResolvedValueOnce({
        error:
          "El código no es correcto o ha caducado. Prueba con el siguiente.",
      })
      .mockResolvedValueOnce(undefined);
    const { startAction } = renderSetup({ confirmAction });
    await start();

    await userEvent.type(screen.getByTestId("totp-code"), "000000");
    await userEvent.click(screen.getByTestId("totp-submit"));
    await screen.findByTestId("totp-error");
    expect(screen.getByTestId("totp-secret")).toHaveTextContent(
      "JBSWY3DPEHPK3PXP",
    );

    await userEvent.clear(screen.getByTestId("totp-code"));
    await userEvent.type(screen.getByTestId("totp-code"), "123456");
    await userEvent.click(screen.getByTestId("totp-submit"));

    expect(confirmAction).toHaveBeenCalledTimes(2);
    expect(confirmAction.mock.calls[1]![1].get("factorId")).toBe("factor-1");
    expect(startAction).toHaveBeenCalledOnce();
  });

  it("shows the failure to prepare enrollment and lets the person try again", async () => {
    const startAction: StartAction = vi
      .fn()
      .mockResolvedValueOnce({
        error: "No se ha podido preparar la verificación. Recarga la página.",
      })
      .mockResolvedValueOnce(enrollment);
    renderSetup({ startAction });

    await userEvent.click(screen.getByTestId("totp-start"));
    const alert = await screen.findByTestId("totp-error");
    expect(alert).toHaveTextContent(
      "No se ha podido preparar la verificación. Recarga la página.",
    );

    await userEvent.click(screen.getByTestId("totp-start"));
    await screen.findByTestId("totp-secret");
    expect(startAction).toHaveBeenCalledTimes(2);
  });
});
