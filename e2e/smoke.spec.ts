import { expect, test } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("página de login é carregada", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.locator("text=Cotani").first()).toBeVisible();
  });

  test("slug inexistente retorna página não encontrada", async ({ page }) => {
    const response = await page.goto("/slug-inexistente-que-nao-existe");

    expect(response?.status()).toBe(404);
  });

  test("página de seed não existe mais", async ({ page }) => {
    const response = await page.goto("/seed");

    expect(response?.status()).toBe(404);
  });
});
