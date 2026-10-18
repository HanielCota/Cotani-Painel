import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CopyBookingLink } from "@/components/dashboard/copy-booking-link";
import { readBookingLinkShared } from "@/lib/booking-link-shared";
import { render } from "@/test/utils";
import { markBookingLinkSharedOnServer } from "@/server/actions/onboarding";

vi.mock("@/server/actions/onboarding", () => ({ markBookingLinkSharedOnServer: vi.fn(async () => ({ status: "success", message: "" })) }));

describe("CopyBookingLink", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("copiar o link também conclui o passo de divulgação do checklist", async () => {
    render(<CopyBookingLink url="https://painel.cotani.com.br/loja" />);

    fireEvent.click(screen.getByRole("button", { name: /copiar link de agendamento/i }));

    await waitFor(() => expect(readBookingLinkShared()).toBe(true));
    expect(markBookingLinkSharedOnServer).toHaveBeenCalled();
  });
});
