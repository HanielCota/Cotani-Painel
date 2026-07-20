import { vi } from "vitest";

export const prismaMock = {
  appointment: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  customer: {
    count: vi.fn(),
  },
  service: {
    count: vi.fn(),
  },
  clinic: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  webhookEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  membership: {
    findFirst: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));
