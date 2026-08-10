import { expect, test } from "@playwright/test";

test.describe("スライド送り (vanilla.html)", () => {
  test("矢印クリックで次/前のスライドに切り替わる", async ({ page }) => {
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="lion"]').click();

    const dialog = page.locator("dialog.smartphoto");
    const caption = dialog.locator(".smartphoto-caption");
    await expect(caption).toHaveText("Lion");

    await page.getByRole("button", { name: "go to the next image" }).click();
    await expect(caption).toHaveText("Camel");

    await page
      .getByRole("button", { name: "go to the previous image" })
      .click();
    await expect(caption).toHaveText("Lion");
  });

  test("矢印キーで次/前のスライドに切り替わる", async ({ page }) => {
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="lion"]').click();

    const dialog = page.locator("dialog.smartphoto");
    const caption = dialog.locator(".smartphoto-caption");
    await expect(caption).toHaveText("Lion");

    // open 直後は View Transition のセットアップが安定するまでの短い間、
    // キーボード入力のような「実イベントパイプラインを介さない/待ちのない」操作が
    // 取りこぼされることがある。既定の animationSpeed(300ms) 分待って安定させる
    await page.waitForTimeout(350);
    await page.keyboard.press("ArrowRight");
    await expect(caption).toHaveText("Camel");

    await page.keyboard.press("ArrowLeft");
    await expect(caption).toHaveText("Lion");
  });

  test("閉じるアニメーション完了前に再度開いても、遅延した close イベントでモーダルが閉じない", async ({
    page,
  }) => {
    // hidePhoto() は閉じるアニメーション(transitionend)完了後に公開の "close"
    // イベントを dialog 要素上へ発火するが、これはネイティブ dialog の "close"
    // イベントと同じ型名を共有していた。閉じてから閉じるアニメーションの完了
    // (既定 300ms)より前に素早く別/同じ画像を開くと、この遅延発火する公開
    // イベントを「ネイティブ close 同期」用リスナーが誤って拾い、既に再オープン
    // した(isOpen=true)モーダルへ hidePhoto() を再度呼び出して閉じてしまう
    // 回帰があった。何度も高速に開閉を繰り返して再現させる
    await page.goto("/examples/vanilla.html");
    const dialog = page.locator("dialog.smartphoto");
    const caption = dialog.locator(".smartphoto-caption");
    const trigger = page.locator('a[data-id="lion"]');

    for (let i = 0; i < 5; i++) {
      await trigger.click();
      await expect(caption).toHaveText("Lion");
      await page.getByRole("button", { name: "go to the next image" }).click();
      await expect(dialog).toHaveJSProperty("open", true);
      await expect(caption).toHaveText("Camel");
      await page
        .getByRole("button", { name: "close the image dialog" })
        .click();
      await expect(dialog).toHaveJSProperty("open", false);
    }
  });

  test("ナビゲーション(サムネイル一覧)クリックで該当スライドに切り替わる", async ({
    page,
  }) => {
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="lion"]').click();

    const dialog = page.locator("dialog.smartphoto");
    const caption = dialog.locator(".smartphoto-caption");

    await dialog.locator(".smartphoto-nav li").nth(3).locator("button").click();
    await expect(caption).toHaveText("Koala");
  });

  test("change イベントが現在の位置を伴って発火する", async ({ page }) => {
    await page.goto("/examples/event.html");
    const logs: string[] = [];
    page.on("console", (msg) => logs.push(msg.text()));

    await page.locator('a[data-id="lion"]').click();
    await expect.poll(() => logs).toContain("open");

    await page.getByRole("button", { name: "go to the next image" }).click();
    await expect.poll(() => logs).toContain("change");
  });
});
