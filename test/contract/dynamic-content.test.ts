import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import SmartPhoto from "../../src/index";

// Ajax等で後から追加されるサムネイル要素を模して生成する
function appendThumbnail(
  container: HTMLElement,
  {
    href,
    caption,
    id,
    group,
  }: { href: string; caption: string; id: string; group: string },
): HTMLElement {
  const a = document.createElement("a");
  a.href = href;
  a.className = "js-smartphoto";
  a.setAttribute("data-caption", caption);
  a.setAttribute("data-id", id);
  a.setAttribute("data-group", group);
  const img = document.createElement("img");
  img.src = href.replace("large-", "");
  img.alt = caption;
  a.appendChild(img);
  container.appendChild(a);
  return a;
}

describe("Ajax等による動的なDOM追加への自動対応(§document デリゲーション)", () => {
  let container: HTMLElement;
  let smartPhoto: SmartPhoto | undefined;
  let extra: SmartPhoto | undefined;

  afterEach(() => {
    smartPhoto?.destroy();
    extra?.destroy();
    smartPhoto = undefined;
    extra = undefined;
    container.remove();
    document.querySelectorAll("dialog.smartphoto").forEach((d) => {
      d.remove();
    });
  });

  it("構築後に追加された要素も addNewItem を呼ばずクリックのみで開ける(既存グループ)", async () => {
    container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g">
        <img src="./a.jpg" alt="A" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");

    const added = appendThumbnail(container, {
      href: "./large-b.jpg",
      caption: "B",
      id: "b",
      group: "g",
    });

    fireEvent.click(added);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "B",
      );
    });
    expect(document.querySelectorAll(".smartphoto-list > li").length).toBe(2);
  });

  it("構築後に追加された要素も新規グループとして自動認識される", async () => {
    container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g1">
        <img src="./a.jpg" alt="A" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");

    const added = appendThumbnail(container, {
      href: "./large-c.jpg",
      caption: "C",
      id: "c",
      group: "g2",
    });

    fireEvent.click(added);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "C",
      );
    });
    // 新規グループには追加要素の1件だけが含まれる(既存グループには混ざらない)
    expect(document.querySelectorAll(".smartphoto-list > li").length).toBe(1);
  });

  it("動的追加分にも next()/prev() で辿れる", async () => {
    container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g">
        <img src="./a.jpg" alt="A" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");

    const added = appendThumbnail(container, {
      href: "./large-b.jpg",
      caption: "B",
      id: "b",
      group: "g",
    });

    fireEvent.click(added);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "B",
      );
    });
    smartPhoto.prev();
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "A",
      );
    });
  });

  it("既存サムネイルの再クリックだけで新規追加分がスライドリストに反映される", async () => {
    container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g">
        <img src="./a.jpg" alt="A" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");
    const original = container.querySelector(".js-smartphoto") as HTMLElement;

    fireEvent.click(original);
    // caption は index0("A")では構築時の初期描画と偶然一致するため、
    // 開く処理(非同期)が確実に完了したことを dialog の open 属性で確認する
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(document.querySelectorAll(".smartphoto-list > li").length).toBe(1);

    appendThumbnail(container, {
      href: "./large-b.jpg",
      caption: "B",
      id: "b",
      group: "g",
    });

    // 既に登録済みの要素(=クリック時にitemsByElementにヒットする要素)を
    // 再クリックしても、その場でグループが再スキャンされ新規追加分が反映される
    fireEvent.click(original);
    await waitFor(() => {
      expect(document.querySelectorAll(".smartphoto-list > li").length).toBe(2);
    });
  });

  it("登録前に data-group を書き換えると、書き換え後の値でグループ分類される", async () => {
    container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-x.jpg" class="js-smartphoto" data-caption="X" data-id="x" data-group="changed">
        <img src="./x.jpg" alt="X" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");

    const added = appendThumbnail(container, {
      href: "./large-y.jpg",
      caption: "Y",
      id: "y",
      group: "orig",
    });
    // 登録(=初回クリック)前に data-group を書き換える
    added.setAttribute("data-group", "changed");

    fireEvent.click(added);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "Y",
      );
    });
    // "changed" グループに分類されていれば X と同じグループの2件になる
    expect(document.querySelectorAll(".smartphoto-list > li").length).toBe(2);
  });

  it("DOMから削除された要素は、次に何かを開いた時にグループから除去される", async () => {
    container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g">
        <img src="./a.jpg" alt="A" />
      </a>
      <a href="./large-b.jpg" class="js-smartphoto" data-caption="B" data-id="b" data-group="g">
        <img src="./b.jpg" alt="B" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");
    const [aEl, bEl] = Array.from(
      container.querySelectorAll(".js-smartphoto"),
    ) as HTMLElement[];

    fireEvent.click(aEl);
    // caption は index0("A")では構築時の初期描画と偶然一致するため、
    // 開く処理(非同期)が確実に完了したことを dialog の open 属性で確認する
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(document.querySelectorAll(".smartphoto-list > li").length).toBe(2);

    aEl.remove();

    // 削除された要素自体はもうクリックできないため、同グループの別要素を
    // 開くタイミングで削除が検出される(§resyncGroupFromDom はダイアログを
    // 開く直前にのみ整合を取る)
    fireEvent.click(bEl);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "B",
      );
    });
    expect(document.querySelectorAll(".smartphoto-list > li").length).toBe(1);
  });

  it("削除後に残った要素の index が再計算され next()/prev() が正しく機能する", async () => {
    container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g">
        <img src="./a.jpg" alt="A" />
      </a>
      <a href="./large-b.jpg" class="js-smartphoto" data-caption="B" data-id="b" data-group="g">
        <img src="./b.jpg" alt="B" />
      </a>
      <a href="./large-c.jpg" class="js-smartphoto" data-caption="C" data-id="c" data-group="g">
        <img src="./c.jpg" alt="C" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");
    const [aEl, bEl, cEl] = Array.from(
      container.querySelectorAll(".js-smartphoto"),
    ) as HTMLElement[];

    // 真ん中(B)を削除してから、Aを起点に開いて next() で C まで正しく辿れることを確認する
    bEl.remove();

    fireEvent.click(aEl);
    // caption は index0("A")では構築時の初期描画と偶然一致するため、
    // 開く処理(非同期)が確実に完了したことを dialog の open 属性で確認する
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(document.querySelectorAll(".smartphoto-list > li").length).toBe(2);

    smartPhoto.next();
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "C",
      );
    });

    // 削除前のCの参照が残っていないことの確認(cElは元々の要素のまま)
    expect(cEl.isConnected).toBe(true);
  });

  it("ダイアログを開いている間の next()/prev() では削除が反映されない(スコープの境界)", async () => {
    container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g">
        <img src="./a.jpg" alt="A" />
      </a>
      <a href="./large-b.jpg" class="js-smartphoto" data-caption="B" data-id="b" data-group="g">
        <img src="./b.jpg" alt="B" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");
    const [aEl, bEl] = Array.from(
      container.querySelectorAll(".js-smartphoto"),
    ) as HTMLElement[];

    fireEvent.click(aEl);
    // caption は index0("A")では構築時の初期描画と偶然一致するため、
    // 開く処理(非同期)が確実に完了したことを dialog の open 属性で確認する
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });

    // 開いたままの状態でDOMから削除しても、resyncGroupFromDom は
    // openPhoto() 実行時(=ダイアログを開く瞬間)にしか走らないため、
    // next() だけでは削除が反映されない
    bEl.remove();

    smartPhoto.next();
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "B",
      );
    });
  });

  it("セレクタが重複する複数インスタンスでも1クリックで多重に開かない", async () => {
    container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g">
        <img src="./a.jpg" alt="A" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");
    extra = new SmartPhoto(".js-smartphoto");

    fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
    await waitFor(() => {
      expect(document.querySelectorAll("dialog.smartphoto[open]").length).toBe(
        1,
      );
    });
  });
});
