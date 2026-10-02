import { beforeEach, describe, expect, it, vi } from "vitest";

const loadAppointmentDetail = vi.fn();

vi.mock("./load-detail", () => ({ loadAppointmentDetail }));

const { fetchAppointmentDetail } = await import("./actions");

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  loadAppointmentDetail.mockReset();
});

describe("fetchAppointmentDetail", () => {
  it("loads the appointment the drawer is opening, so the panel fills in without reloading the whole agenda", async () => {
    loadAppointmentDetail.mockResolvedValue({ status: "none" });

    await fetchAppointmentDetail(ID);

    expect(loadAppointmentDetail).toHaveBeenCalledWith(ID);
  });

  it("does not query the database for a hand-edited id that cannot be an appointment", async () => {
    const result = await fetchAppointmentDetail("no-es-un-id");

    expect(result).toEqual({ status: "none" });
    expect(loadAppointmentDetail).not.toHaveBeenCalled();
  });
});
