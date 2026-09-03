import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { render } from "@/test/utils";

describe("SidebarTrigger", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  it("mantém o controle visível e alterna entre recolher e expandir", () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );

    const collapseButton = screen.getByRole("button", { name: "Recolher navegação" });
    expect(collapseButton.querySelector(".lucide-panel-left-close")).toBeInTheDocument();

    fireEvent.click(collapseButton);

    const expandButton = screen.getByRole("button", { name: "Expandir navegação" });
    expect(expandButton.querySelector(".lucide-panel-left-open")).toBeInTheDocument();
  });
});
