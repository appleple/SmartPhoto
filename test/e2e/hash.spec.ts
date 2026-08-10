import { expect, test } from "@playwright/test";

test.describe("URL ハッシュによる復元 (vanilla.html)", () => {
  test("#group=...&photo=... 付きで開くと該当スライドが自動的に開く", async ({
    page,
  }) => {
    await page.goto("/examples/vanilla.html#group=nogroup&photo=camel");

    const dialog = page.locator("dialog.smartphoto");
    await expect(dialog).toHaveJSProperty("open", true);
    await expect(dialog.locator(".smartphoto-caption")).toHaveText("Camel");
  });

  test("スライドを切り替えるとハッシュが追従する", async ({ page }) => {
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="lion"]').click();

    await expect(page).toHaveURL(/#group=nogroup&photo=lion$/);

    await page.getByRole("button", { name: "go to the next image" }).click();
    await expect(page).toHaveURL(/#group=nogroup&photo=camel$/);
  });
});
