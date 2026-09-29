import { beforeEach, describe, expect, it, vi } from "vitest";

type RpcResult = { data: unknown; error: { message: string } | null };

const rpc = vi.fn<(name: string) => Promise<RpcResult>>();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({ rpc }),
}));

const { regenerateCalendarLink } = await import("./actions");

beforeEach(() => {
  rpc.mockReset();
  revalidatePath.mockReset();
});

describe("regenerateCalendarLink", () => {
  it("asks the database for a new secret token, so any earlier link stops working", async () => {
    rpc.mockResolvedValue({ data: "nuevo-token", error: null });

    const result = await regenerateCalendarLink();

    expect(rpc).toHaveBeenCalledWith("regenerate_my_calendar_token");
    expect(result).toEqual({ ok: true });
  });

  it("refreshes the page so the professional sees the new link right away", async () => {
    rpc.mockResolvedValue({ data: "nuevo-token", error: null });

    await regenerateCalendarLink();

    expect(revalidatePath).toHaveBeenCalledWith("/mi-calendario");
  });

  it("explains the failure and leaves the page as it was when the database refuses", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "calendar_token_forbidden" },
    });

    const result = await regenerateCalendarLink();

    expect(result).toEqual({
      error: "No se ha podido crear el enlace. Inténtalo de nuevo.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
