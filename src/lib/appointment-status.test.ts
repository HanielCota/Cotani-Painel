import { describe, expect, it } from "vitest";
import { checkAppointmentTransition, getAllowedAppointmentTransitions } from "./appointment-status";

const now = new Date("2026-10-07T15:00:00Z");

describe("ciclo de vida do atendimento", () => {
  it("não oferece concluir/falta antes do horário", () => {
    expect(getAllowedAppointmentTransitions("CONFIRMED", "2026-10-08T15:00:00Z", now)).toEqual(["CANCELED"]);
    expect(getAllowedAppointmentTransitions("PENDING", "2026-10-08T15:00:00Z", now)).toEqual(["CONFIRMED", "CANCELED"]);
  });

  it("libera concluir/falta depois que o horário começou", () => {
    expect(getAllowedAppointmentTransitions("CONFIRMED", "2026-10-07T14:00:00Z", now)).toEqual(["COMPLETED", "CANCELED", "NO_SHOW"]);
  });

  it("status terminal não aceita transições", () => {
    expect(getAllowedAppointmentTransitions("COMPLETED", "2026-10-07T14:00:00Z", now)).toEqual([]);
    expect(checkAppointmentTransition("CANCELED", "CONFIRMED", "2026-10-07T14:00:00Z", now)).toEqual({ ok: false, reason: "invalid" });
  });

  it("diferencia transição inválida de horário ainda não iniciado", () => {
    expect(checkAppointmentTransition("PENDING", "COMPLETED", "2026-10-07T14:00:00Z", now)).toEqual({ ok: false, reason: "invalid" });
    expect(checkAppointmentTransition("CONFIRMED", "COMPLETED", "2026-10-08T14:00:00Z", now)).toEqual({ ok: false, reason: "not-started" });
    expect(checkAppointmentTransition("CONFIRMED", "COMPLETED", "2026-10-07T14:00:00Z", now)).toEqual({ ok: true });
  });
});
