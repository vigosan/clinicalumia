import { describe, expect, it } from "vitest";
import { NOTICE_FAILED, noticeToast } from "./notice-toast";

describe("noticeToast", () => {
  it("only confirms the change when the patient was told or nobody had to be", () => {
    expect(noticeToast("Cita creada")("/?date=2026-10-05&appointment=a1")).toBe(
      "Cita creada",
    );
  });

  it("adds that the patient was not told when the email failed, so the team calls them instead", () => {
    expect(
      noticeToast("Cita cambiada")(
        "/?date=2026-10-05&appointment=a1&aviso=sin-avisar",
      ),
    ).toBe(`Cita cambiada. ${NOTICE_FAILED}`);
    expect(NOTICE_FAILED).toBe("No se ha podido avisar al paciente.");
  });
});
