import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = { ok: true as const, userId: "owner-1" };
let ownerResult: { ok: true; userId: string } | { ok: false; error: string } =
  owner;
const updateResult = { error: null as null | { code: string } };
const updateEq = vi.fn(async () => updateResult);
const selectSingle = vi.fn(
  async (): Promise<{ data: { logo_path: string | null } }> => ({
    data: { logo_path: null },
  }),
);
const upload = vi.fn(async () => ({ error: null }));
const remove = vi.fn(async () => ({ error: null }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: () => ({ eq: updateEq }),
      select: () => ({ eq: () => ({ single: selectSingle }) }),
    }),
    storage: { from: () => ({ upload, remove }) },
  }),
}));
vi.mock("@clinicalumia/api/auth", () => ({
  requireOwner: async () => ownerResult,
}));

const { saveClinicSettings, uploadLogo } = await import("./actions");

function clinicForm(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    legal_name: "Patricia Hernán Sánchez",
    tax_id: "20449989E",
    address_line: "Calle Montesa 7",
    postal_code: "46800",
    city: "Xàtiva",
    province: "Valencia",
    phone: "614 552 808",
    email: "info@clinicalumia.es",
    website: "https://www.clinicalumia.es",
    vat_exemption_text: "Exento",
    invoice_footer: "",
    invoice_prefix: "",
    rectifying_prefix: "R",
    cancellation_hours: "24",
    booking_min_notice_hours: "24",
    booking_horizon_days: "60",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    data.set(key, value);
  }
  return data;
}

function logoForm(file: File) {
  const data = new FormData();
  data.set("logo", file);
  return data;
}

describe("saveClinicSettings", () => {
  beforeEach(() => {
    ownerResult = owner;
    updateResult.error = null;
    updateEq.mockClear();
  });

  it("refuses to save for a non-owner and never touches the database", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(await saveClinicSettings(undefined, clinicForm())).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(updateEq).not.toHaveBeenCalled();
  });

  it("returns the parser's error for an invalid form without touching the database", async () => {
    expect(
      await saveClinicSettings(undefined, clinicForm({ tax_id: "20449989A" })),
    ).toEqual({
      error: "El NIF/CIF no es válido. Revisa la letra o el dígito de control.",
    });
    expect(updateEq).not.toHaveBeenCalled();
  });

  it("reports a database error when saving fails", async () => {
    updateResult.error = { code: "500" };
    expect(await saveClinicSettings(undefined, clinicForm())).toEqual({
      error: "No se han podido guardar los datos.",
    });
  });
});

describe("uploadLogo", () => {
  beforeEach(() => {
    ownerResult = owner;
    updateResult.error = null;
    updateEq.mockClear();
    selectSingle.mockClear();
    selectSingle.mockImplementation(async () => ({
      data: { logo_path: null },
    }));
    upload.mockClear();
    upload.mockImplementation(async () => ({ error: null }));
    remove.mockClear();
  });

  function pngFile(sizeInBytes: number) {
    return new File([new Uint8Array(sizeInBytes)], "logo.png", {
      type: "image/png",
    });
  }

  it("refuses to upload for a non-owner and never touches storage", async () => {
    ownerResult = { ok: false, error: "No tienes permiso para hacer esto." };
    expect(await uploadLogo(undefined, logoForm(pngFile(100)))).toEqual({
      error: "No tienes permiso para hacer esto.",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a file larger than 2 MB without uploading it", async () => {
    expect(
      await uploadLogo(undefined, logoForm(pngFile(3 * 1024 * 1024))),
    ).toEqual({
      error: "El logo no puede pesar más de 2 MB.",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects a file type outside PNG/JPEG/WebP/SVG without uploading it", async () => {
    const gif = new File([new Uint8Array(100)], "logo.gif", {
      type: "image/gif",
    });
    expect(await uploadLogo(undefined, logoForm(gif))).toEqual({
      error: "El logo debe ser PNG, JPG, WebP o SVG.",
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("removes the just-uploaded file when saving its path fails", async () => {
    updateResult.error = { code: "500" };
    await uploadLogo(undefined, logoForm(pngFile(100)));
    expect(remove).toHaveBeenCalledWith([
      expect.stringMatching(/^logo-\d+\.png$/),
    ]);
  });

  it("removes the previous logo once the replacement has saved, so storage doesn't accumulate unused files", async () => {
    selectSingle.mockImplementation(async () => ({
      data: { logo_path: "logo-111.png" },
    }));
    await uploadLogo(undefined, logoForm(pngFile(100)));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(["logo-111.png"]);
  });
});
