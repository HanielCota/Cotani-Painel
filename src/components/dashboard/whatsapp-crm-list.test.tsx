import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WhatsAppCrmList } from "@/components/dashboard/whatsapp-crm-list";
import { render } from "@/test/utils";
import type { WhatsAppNotificationItem } from "@/server/services/whatsapp-crm";

vi.mock("@/server/actions/whatsapp-crm", () => ({
  markWhatsAppNotificationAsSent: vi.fn().mockResolvedValue({ status: "success", message: "Enviado" }),
}));

const pendingNotification: WhatsAppNotificationItem = {
  id: "notif-1",
  kind: "CONFIRMATION",
  recipient: "11999999999",
  content: "Olá João! Seu agendamento está confirmado.",
  scheduledFor: new Date("2026-07-22T10:00:00.000Z"),
  attempts: 0,
  whatsappLink: "https://wa.me/5511999999999?text=Ol%C3%A1%20Jo%C3%A3o",
};

describe("WhatsAppCrmList", () => {
  it("renderiza mensagens pendentes com link do WhatsApp", () => {
    render(<WhatsAppCrmList pending={[pendingNotification]} sent={[]} />);

    expect(screen.getByText("Mensagens pendentes")).toBeInTheDocument();
    expect(screen.getByText("11999999999")).toBeInTheDocument();
    expect(screen.getByText(pendingNotification.content)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /abrir whatsapp/i });
    expect(button).toBeInTheDocument();
  });

  it("renderiza mensagens enviadas", () => {
    render(<WhatsAppCrmList pending={[]} sent={[pendingNotification]} />);

    expect(screen.getByText("Últimas enviadas")).toBeInTheDocument();
    expect(screen.getByText("Enviado")).toBeInTheDocument();
  });

  it("mostra estado vazio quando não há mensagens pendentes", () => {
    render(<WhatsAppCrmList pending={[]} sent={[]} />);

    expect(screen.getByText("Nenhuma mensagem pendente no momento.")).toBeInTheDocument();
  });
});
