import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendSend = vi.fn();
const resendKeys: string[] = [];

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSend };
    constructor(key: string) {
      resendKeys.push(key);
    }
  },
}));

const { sendEmail } = await import("./email");

const fetchMock = vi.fn();

const message = {
  to: "lucia@example.com",
  subject: "Cita confirmada",
  html: "<p>Hola</p>",
};

describe("sendEmail", () => {
  beforeEach(() => {
    resendSend.mockReset();
    resendKeys.length = 0;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends through Resend from the clinic's notifications domain when production has an API key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "");
    resendSend.mockResolvedValue({ data: { id: "1" }, error: null });

    await sendEmail(message);

    expect(resendKeys).toEqual(["re_test"]);
    expect(resendSend).toHaveBeenCalledWith({
      from: "Clínica LUMIA <no-responder@notifications.clinicalumia.es>",
      ...message,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses EMAIL_FROM as the sender when it is configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "LUMIA <citas@notifications.clinicalumia.es>");
    resendSend.mockResolvedValue({ data: { id: "1" }, error: null });

    await sendEmail(message);

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "LUMIA <citas@notifications.clinicalumia.es>",
      }),
    );
  });

  it("fails loudly when Resend rejects the email, so a booking never looks confirmed by mail when it was not", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    resendSend.mockResolvedValue({
      data: null,
      error: { message: "domain not verified" },
    });

    await expect(sendEmail(message)).rejects.toThrow("domain not verified");
  });

  it("delivers to local Mailpit when there is no API key, so development never emails real people", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await sendEmail(message);

    expect(resendSend).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.lastCall ?? [];
    expect(url).toBe("http://127.0.0.1:54324/api/v1/send");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      From: {
        Name: "Clínica LUMIA",
        Email: "no-responder@notifications.clinicalumia.es",
      },
      To: [{ Email: "lucia@example.com" }],
      Subject: "Cita confirmada",
      HTML: "<p>Hola</p>",
    });
  });

  it("fails loudly when Mailpit does not accept the email", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    fetchMock.mockResolvedValue(new Response("bad", { status: 400 }));

    await expect(sendEmail(message)).rejects.toThrow(/Mailpit.*400/);
  });
});
