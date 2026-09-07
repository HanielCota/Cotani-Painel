import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { generateIcsContent, parseLocalDateTime, SuccessActions } from "@/components/public/success-actions";

describe("ações do comprovante público", () => {
  it("rejeita datas normalizadas pelo JavaScript e horários inválidos", () => {
    expect(parseLocalDateTime("2026-02-31", "10:00", "America/Sao_Paulo")).toBeNull();
    expect(parseLocalDateTime("2026-08-31", "25:00", "America/Sao_Paulo")).toBeNull();
    expect(parseLocalDateTime("texto", "10:00", "America/Sao_Paulo")).toBeNull();
  });

  it("neutraliza quebra de linha e metacaracteres em arquivos ICS", () => {
    const content = generateIcsContent({
      title: "Serviço\r\nBEGIN:VEVENT",
      start: new Date("2026-08-31T13:00:00.000Z"),
      end: new Date("2026-08-31T14:00:00.000Z"),
      description: "Linha 1\nLinha 2; teste, ok",
      location: "Loja, Centro",
    });

    expect(content).toContain("SUMMARY:Serviço\\nBEGIN:VEVENT");
    expect(content).not.toContain("SUMMARY:Serviço\r\nBEGIN:VEVENT");
    expect(content).toContain("DESCRIPTION:Linha 1\\nLinha 2\\; teste\\, ok");
    expect(content).toContain("DTSTART:20260831T130000Z");
  });

  it("direciona pedidos de alteração para o WhatsApp da empresa sem prometer alteração automática", () => {
    render(createElement(SuccessActions, {
      clinicName: "Espaço Central",
      service: "Avaliação inicial",
      professional: "Rafael Lima",
      date: "2026-09-16",
      time: "13:00",
      duration: "45",
      timeZone: "America/Sao_Paulo",
      phone: "(11) 99999-9999",
      address: "Rua Central, 100",
    }));

    const whatsappLink = screen.getByRole("button", { name: /falar pelo whatsapp/i });
    expect(whatsappLink).toHaveAttribute("href", expect.stringContaining("https://wa.me/5511999999999"));
    expect(whatsappLink).toHaveAttribute("href", expect.stringContaining("solicitar%20uma%20altera%C3%A7%C3%A3o%20ou%20o%20cancelamento"));
    expect(whatsappLink).toHaveAttribute("href", expect.stringContaining("Data%3A%2016%2F09%2F2026"));
    expect(whatsappLink).toHaveAttribute("href", expect.stringContaining("Hor%C3%A1rio%3A%2013%3A00"));
    expect(screen.getByText(/não altera o atendimento automaticamente/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /como chegar/i })).toHaveAttribute("href", expect.stringContaining("google.com/maps/search"));
  });

  it("explica a opção compatível com outros calendários", () => {
    render(createElement(SuccessActions, {
      clinicName: "Espaço Central",
      date: "2026-09-16",
      time: "13:00",
      timeZone: "America/Sao_Paulo",
    }));

    expect(screen.getByRole("button", { name: /google agenda/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /outros calendários/i })).toBeInTheDocument();
    expect(screen.getByText(/apple, outlook, samsung/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /compartilhar link/i })).not.toBeInTheDocument();
  });
});
