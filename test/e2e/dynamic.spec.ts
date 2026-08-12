import { expect, test } from "@playwright/test";

test.describe("Ajax等による動的なDOM追加 (dynamic.html)", () => {
  test("読み込みボタンで追加したサムネイルも addItem() なしでクリックのみで開ける", async ({
    page,
  }) => {
    await page.goto("/examples/dynamic.html");
    const dialog = page.locator("dialog.smartphoto");

    // 初期状態では未読み込みのサムネイルはDOM上に存在しない
    await expect(page.locator('a[data-id="koala"]')).toHaveCount(0);

    await page
      .getByRole("button", { name: "Load more (simulate Ajax)" })
      .click();
    const added = page.locator('a[data-id="koala"]');
    await expect(added).toHaveCount(1);

    await added.click();

    await expect(dialog).toHaveJSProperty("open", true);
    await expect(dialog.locator(".smartphoto-caption")).toHaveText("Koala");
  });

  test("動的追加分にも next() で辿れる(同一グループへの反映)", async ({
    page,
  }) => {
    await page.goto("/examples/dynamic.html");
    const dialog = page.locator("dialog.smartphoto");
    const caption = dialog.locator(".smartphoto-caption");

    // 構築時から存在する既存サムネイル(Bear)を開く
    await page.locator('a[data-id="bear"]').click();
    await expect(dialog).toHaveJSProperty("open", true);
    await expect(caption).toHaveText("Bear");
    await page.waitForTimeout(350);

    // showModal() 中は背後要素(Load moreボタン)への実クリックがネイティブに
    // 遮断されるため、element.click() を直接呼び出してハンドラを起動する
    await page
      .getByRole("button", { name: "Load more (simulate Ajax)" })
      .evaluate((el: HTMLElement) => el.click());
    await expect(page.locator('a[data-id="koala"]')).toHaveCount(1);

    // 既存サムネイルの再クリックで、そのタイミングでダイアログを開き直す際に
    // グループがDOMの現在状態に合わせて再構築され、新規追加分がスライドリストに
    // 反映される(resyncGroupFromDom)。ネイティブ dialog は showModal() 中に
    // 背後要素への実クリックを遮断するため、element.click() を直接呼び出して
    // ハンドラの結線を検証する
    await page
      .locator('a[data-id="bear"]')
      .evaluate((el: HTMLElement) => el.click());
    await expect(caption).toHaveText("Bear");

    await page
      .getByRole("button", { name: "go to the next image" })
      .evaluate((el: HTMLElement) => el.click());
    await expect(caption).toHaveText("Camel");

    await page
      .getByRole("button", { name: "go to the next image" })
      .evaluate((el: HTMLElement) => el.click());
    await expect(caption).toHaveText("Koala");
  });

  test("削除ボタンで消したサムネイルは、次に別の写真を開いた時にグループから除去される", async ({
    page,
  }) => {
    await page.goto("/examples/dynamic.html");
    const dialog = page.locator("dialog.smartphoto");
    const caption = dialog.locator(".smartphoto-caption");

    // Bear(先頭)を開いた時点ではまだ削除されていないので Camel に辿れる
    await page.locator('a[data-id="bear"]').click();
    await expect(dialog).toHaveJSProperty("open", true);
    await expect(caption).toHaveText("Bear");
    await page.waitForTimeout(350);

    await page
      .getByRole("button", { name: "Remove first thumbnail (simulate Ajax)" })
      .evaluate((el: HTMLElement) => el.click());
    await expect(page.locator('a[data-id="bear"]')).toHaveCount(0);

    // 削除された Bear 自体はもうクリックできないので、Camel を開き直して
    // 削除の反映(ダイアログを開く直前の再構築)を検証する
    await page
      .locator('a[data-id="camel"]')
      .evaluate((el: HTMLElement) => el.click());
    await expect(caption).toHaveText("Camel");

    // 削除後にグループに残るのは Camel の1件だけなので、次/前どちらの矢印も
    // 表示されない(APGのhidden切り替えではなく実際にDOM上hiddenになる)
    await expect(
      page.getByRole("button", { name: "go to the next image" }),
    ).toBeHidden();
  });
});
