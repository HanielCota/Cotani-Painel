import { expect, test } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("página de login é carregada", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.locator("text=Cotani").first()).toBeVisible();
  });

  test("página inicial redireciona para login quando não autenticado", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/sign-in/);
  });

  test("slug inexistente retorna página não encontrada", async ({ page }) => {
    const response = await page.goto("/slug-inexistente-que-nao-existe");

    expect(response?.status()).toBe(404);
  });

  test("página de seed não existe mais", async ({ page }) => {
    const response = await page.goto("/seed");

    expect(response?.status()).toBe(404);
  });

  test("dashboard redireciona para login quando não autenticado", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/sign-in/);
  });

  test("robots.txt está acessível", async ({ page }) => {
    const response = await page.goto("/robots.txt");

    expect(response?.status()).toBe(200);
    const content = await response?.text();
    expect(content).toContain("User-Agent");
  });

  test("manifest.webmanifest está acessível", async ({ page }) => {
    const response = await page.goto("/manifest.webmanifest");

    expect(response?.status()).toBe(200);
    const content = await response?.json();
    expect(content.name).toBe("Cotani");
  });
});
