import { expect, test } from "@playwright/test";

test.describe("データソースモード (programmatic.html)", () => {
  test("show(index) でインデックス指定のスライドが開く", async ({ page }) => {
    await page.goto("/examples/programmatic.html");
    const dialog = page.locator("dialog.smartphoto");

    await page.getByRole("button", { name: "show(0)" }).click();

    await expect(dialog).toHaveJSProperty("open", true);
    await expect(dialog.locator(".smartphoto-caption")).toHaveText("Lion");
  });

  test("show(id) でID指定のスライドが開く", async ({ page }) => {
    await page.goto("/examples/programmatic.html");
    const dialog = page.locator("dialog.smartphoto");

    await page.getByRole("button", { name: 'show("koala")' }).click();

    await expect(dialog).toHaveJSProperty("open", true);
    await expect(dialog.locator(".smartphoto-caption")).toHaveText("Koala");
  });

  test("next()/prev() でスライドが切り替わる", async ({ page }) => {
    await page.goto("/examples/programmatic.html");
    const dialog = page.locator("dialog.smartphoto");
    const caption = dialog.locator(".smartphoto-caption");

    await page.getByRole("button", { name: "show(0)" }).click();
    await expect(caption).toHaveText("Lion");

    // open 直後は View Transition のセットアップが安定するまでの短い間、
    // 実イベントパイプラインを介さない操作(下記の evaluate 経由クリック)を
    // 取りこぼすことがあるため、既定の animationSpeed(450ms) 分待って安定させる
    await page.waitForTimeout(500);

    // showModal() 中はネイティブ dialog のトップレイヤーが背後の要素へのポインタイベントを
    // 遮断する(仕様どおりの挙動)。ボタン自身のクリックハンドラの結線を検証したいだけなので
    // 実クリックの代わりに element.click() を直接呼び出し、遮断を迂回する
    await page
      .getByRole("button", { name: "next()" })
      .evaluate((el: HTMLElement) => el.click());
    await expect(caption).toHaveText("Camel");

    await page
      .getByRole("button", { name: "prev()" })
      .evaluate((el: HTMLElement) => el.click());
    await expect(caption).toHaveText("Lion");
  });

  test("hide() で閉じる", async ({ page }) => {
    await page.goto("/examples/programmatic.html");
    const dialog = page.locator("dialog.smartphoto");

    await page.getByRole("button", { name: "show(0)" }).click();
    await expect(dialog).toHaveJSProperty("open", true);
    // 既定の animationSpeed(450ms) 分待って安定させる
    await page.waitForTimeout(500);

    // 同上: showModal() 中は背後のボタンへの実クリックがネイティブに遮断されるため
    // element.click() で直接ハンドラを起動する
    await page
      .getByRole("button", { name: "hide()" })
      .evaluate((el: HTMLElement) => el.click());
    await expect(dialog).toHaveJSProperty("open", false);
  });

  test("サムネイル(<a>要素なし)クリックで trigger 経由で開く", async ({
    page,
  }) => {
    await page.goto("/examples/programmatic.html");
    const dialog = page.locator("dialog.smartphoto");
    const thumb = page.locator('.js-thumb[data-index="2"]');

    await thumb.click();

    await expect(dialog).toHaveJSProperty("open", true);
    await expect(dialog.locator(".smartphoto-caption")).toHaveText("Koala");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveJSProperty("open", false);
  });
});
