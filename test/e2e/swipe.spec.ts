import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";

// jsdom + 合成 dispatchEvent(PointerEvent) では setPointerCapture が実ポインタと
// 紐付かず例外になる(pinch のマルチタッチは jsdom では検証不能)。実 Chromium 上の
// 本物のマウス操作で発火する PointerEvent を使い、gestures.ts のスワイプ判定
// (swipeOffset=100px 以上の水平移動)を検証する

// open 直後は View Transition のセットアップが安定するまでの短い間、実イベント
// パイプラインを介さない/待ちのない操作(生の mouse.move/down/up シーケンス)を
// 取りこぼすことがあるため、既定の animationSpeed(450ms) 分待って安定させてから
// boundingBox を取得する
async function stableBoundingBox(locator: Locator) {
  await locator.page().waitForTimeout(600);
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("content area not found");
  }
  return box;
}

test.describe("スワイプ操作 (vanilla.html)", () => {
  test("コンテンツ領域を左方向にドラッグすると次のスライドへ進む", async ({
    page,
  }) => {
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="lion"]').click();

    const dialog = page.locator("dialog.smartphoto");
    const caption = dialog.locator(".smartphoto-caption");
    await expect(caption).toHaveText("Lion");

    // 中央に表示される拡大画像(smartphoto-list, z-index:101)がコンテンツ領域上に
    // 重なっているため、ドラッグ開始点は画像の外側になる端に寄せる
    const box = await stableBoundingBox(dialog.locator(".smartphoto-content"));
    const startX = box.x + box.width * 0.95;
    const y = box.y + box.height / 2;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 60, y, { steps: 5 });
    await page.mouse.move(startX - 180, y, { steps: 5 });
    await page.mouse.up();

    await expect(caption).toHaveText("Camel");
  });

  test("コンテンツ領域を右方向にドラッグすると前のスライドへ戻る", async ({
    page,
  }) => {
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="camel"]').click();

    const dialog = page.locator("dialog.smartphoto");
    const caption = dialog.locator(".smartphoto-caption");
    await expect(caption).toHaveText("Camel");

    const box = await stableBoundingBox(dialog.locator(".smartphoto-content"));
    const startX = box.x + box.width * 0.05;
    const y = box.y + box.height / 2;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + 60, y, { steps: 5 });
    await page.mouse.move(startX + 180, y, { steps: 5 });
    await page.mouse.up();

    await expect(caption).toHaveText("Lion");
  });

  test("わずかな移動量(swipeOffset未満)ではスライドが切り替わらない", async ({
    page,
  }) => {
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="lion"]').click();

    const dialog = page.locator("dialog.smartphoto");
    const caption = dialog.locator(".smartphoto-caption");
    await expect(caption).toHaveText("Lion");

    const box = await stableBoundingBox(dialog.locator(".smartphoto-content"));
    const startX = box.x + box.width * 0.95;
    const y = box.y + box.height / 2;

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 30, y, { steps: 3 });
    await page.mouse.up();

    await expect(caption).toHaveText("Lion");
  });

  test("画像本体をタップするとズームする", async ({ page }) => {
    // content(背景)と list(画像本体)は inner の下の兄弟要素であり、片方が
    // 他方の子孫というわけではない(§6.2)。gestures の pointer リスナーが
    // content だけに束縛されていた間は、画像自体をタップしても拾えず
    // ズーム機能が効かない回帰があった
    await page.goto("/examples/vanilla.html");
    await page.locator('a[data-id="lion"]').click();

    const dialog = page.locator("dialog.smartphoto");
    const img = dialog.locator("li.current img.smartphoto-img");
    const box = await stableBoundingBox(img);

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);

    await expect(img).toHaveClass(/smartphoto-img-onmove/);
  });
});
