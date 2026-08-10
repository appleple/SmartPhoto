import { expect, test } from "@playwright/test";

test.describe("開閉ライフサイクル (vanilla.html)", () => {
  test("サムネイルクリックでダイアログが開き、拡大画像が表示される", async ({
    page,
  }) => {
    await page.goto("/examples/vanilla.html");
    const dialog = page.locator("dialog.smartphoto");
    await expect(dialog).not.toHaveJSProperty("open", true);

    await page.locator('a[data-id="lion"]').click();

    await expect(dialog).toHaveJSProperty("open", true);
    const currentImg = dialog.locator("li.current img.smartphoto-img");
    await expect(currentImg).toHaveAttribute("src", /large-lion\.jpg$/);
  });

  test("Escape キーで閉じ、トリガー要素へフォーカスが戻る", async ({
    page,
  }) => {
    await page.goto("/examples/vanilla.html");
    const trigger = page.locator('a[data-id="camel"]');
    await trigger.click();

    const dialog = page.locator("dialog.smartphoto");
    await expect(dialog).toHaveJSProperty("open", true);

    await page.keyboard.press("Escape");

    await expect(dialog).toHaveJSProperty("open", false);
    await expect(trigger).toBeFocused();
  });

  test("close ボタンで閉じる", async ({ page }) => {
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="hippo"]').click();

    const dialog = page.locator("dialog.smartphoto");
    await expect(dialog).toHaveJSProperty("open", true);

    await page.getByRole("button", { name: "close the image dialog" }).click();

    await expect(dialog).toHaveJSProperty("open", false);
  });

  test("背景(コンテンツ領域)クリックで閉じる", async ({ page }) => {
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="bear"]').click();

    const dialog = page.locator("dialog.smartphoto");
    await expect(dialog).toHaveJSProperty("open", true);

    // ヘッダー(上部, z-index:102)・矢印(左右端, z-index:1002)・中央の拡大画像
    // (smartphoto-list, z-index:101)がいずれもコンテンツ領域の上に重なっているため、
    // クリック位置はそれらの外側になる左端寄りにする
    const content = dialog.locator(".smartphoto-content");
    await page.waitForTimeout(350);
    const box = await content.boundingBox();
    if (!box) {
      throw new Error("content area not found");
    }
    await content.click({
      position: { x: box.width * 0.05, y: box.height / 2 },
    });

    await expect(dialog).toHaveJSProperty("open", false);
  });

  test("閉じてから同じサムネイルを再度開くと、2回目も画像が表示される", async ({
    page,
  }) => {
    // doHideEffect() が閉じるアニメーション用に設定した dialog の opacity:0 が
    // 再度開く際にクリアされないと、2回目以降 dialog.open=true でも
    // 画面には何も表示されない状態になる回帰があったため、それを固定する
    await page.goto("/examples/vanilla.html");
    const dialog = page.locator("dialog.smartphoto");
    const trigger = page.locator('a[data-id="lion"]');

    await trigger.click();
    await expect(dialog).toHaveJSProperty("open", true);
    await page.getByRole("button", { name: "close the image dialog" }).click();
    await expect(dialog).toHaveJSProperty("open", false);

    await trigger.click();

    await expect(dialog).toHaveJSProperty("open", true);
    await expect(dialog).toHaveCSS("opacity", "1");
    const currentImg = dialog.locator("li.current img.smartphoto-img");
    await expect(currentImg).toHaveAttribute("src", /large-lion\.jpg$/);
    await expect(currentImg).toBeVisible();
  });

  test("閉じるアニメーション完了前に再度開いても、閉じ演出の translateY が画像に残らない", async ({
    page,
  }) => {
    // doHideEffect() は画像に translateY(ウィンドウ高さ) を設定してスライドアウト
    // させ、transitionend で除去する。閉じるアニメーション完了前に再度開くと
    // トランジションが中断されて transitionend が発火せず、translateY がインライン
    // スタイルへ残留したまま画像が画面外へずれて表示される回帰があったため固定する
    await page.goto("/examples/vanilla.html");
    const dialog = page.locator("dialog.smartphoto");
    const trigger = page.locator('a[data-id="lion"]');

    await trigger.click();
    await expect(dialog).toHaveJSProperty("open", true);
    await page.waitForTimeout(350);
    await page.getByRole("button", { name: "close the image dialog" }).click();
    await expect(dialog).toHaveJSProperty("open", false);
    // 閉じるアニメーション(既定 300ms)の完了を待たずに即座に再オープンする
    await trigger.click();
    await expect(dialog).toHaveJSProperty("open", true);

    const currentImg = dialog.locator("li.current img.smartphoto-img");
    await expect(currentImg).toBeVisible();
    const transform = await currentImg.evaluate((el) => el.style.transform);
    expect(transform).not.toContain("translateY(");
  });

  test("閉じた後、背景スクロールが確実に復帰する", async ({ page }) => {
    // 背景スクロールの抑制は :root:has(dialog.smartphoto[open]) という CSS の
    // みで行っている(§)。以前は JS 側でも document.body.style.overflow を
    // hidden/空文字で手動トグルしており、それが閉じるアニメーションの
    // transitionend 完了を待って解除される実装だったため、transitionend が
    // 何らかの理由で発火しないケースでは overflow:hidden が残り続け、
    // 閉じたのに背景スクロールできなくなる回帰があった。CSS の :has() は
    // dialog の open 属性の有無だけで即時に決まるため、この問題自体が発生しない
    await page.goto("/examples/vanilla.html");
    const html = page.locator("html");
    const dialog = page.locator("dialog.smartphoto");

    await expect(html).toHaveCSS("overflow", "visible");

    await page.locator('a[data-id="lion"]').click();
    await expect(dialog).toHaveJSProperty("open", true);
    await expect(html).toHaveCSS("overflow", "hidden");

    await page.getByRole("button", { name: "close the image dialog" }).click();
    await expect(dialog).toHaveJSProperty("open", false);
    await expect(html).toHaveCSS("overflow", "visible");
  });

  test("開いている間、dialog 自体がホイールスクロールに反応しない", async ({
    page,
  }) => {
    // .smartphoto(dialog本体)には元々 overflow:hidden が指定されていたが、
    // dialog タグへの書き換え時に引き継がれておらず、nav/arrows 等の子要素が
    // わずかにボックスを超えるだけで dialog 自身がスクロール可能になり、
    // 中身がずれて見える回帰があった
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="lion"]').click();
    const dialog = page.locator("dialog.smartphoto");
    await expect(dialog).toHaveJSProperty("open", true);
    await page.waitForTimeout(400);

    await expect(dialog).toHaveCSS("overflow", "hidden");
    const before = await dialog.evaluate((d) => d.scrollTop);
    await page.mouse.move(900, 500);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(100);
    const after = await dialog.evaluate((d) => d.scrollTop);
    expect(after).toBe(before);
  });

  test("閉じる際に dialog がフェードアウトする", async ({ page }) => {
    // dialog.close() は [open] 属性を外すのと同時にネイティブに display:none
    // へ切り替える。CSS の transition だけでは、この discrete な切り替えが
    // フェード演出より先に効いてしまい「ぱっと」消えて見える回帰があったため、
    // allow-discrete で display/overlay もフェード完了まで遅らせている(§8)
    await page.goto("/examples/vanilla.html");
    const dialog = page.locator("dialog.smartphoto");

    await page.locator('a[data-id="lion"]').click();
    await expect(dialog).toHaveJSProperty("open", true);

    await page.getByRole("button", { name: "close the image dialog" }).click();

    const samples: number[] = [];
    for (let i = 0; i < 8; i++) {
      samples.push(
        await dialog.evaluate((d) =>
          Number.parseFloat(getComputedStyle(d).opacity),
        ),
      );
      await page.waitForTimeout(30);
    }
    expect(samples.some((v) => v > 0.05 && v < 0.95)).toBe(true);
  });
});
