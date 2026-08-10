import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SmartPhoto from "../../src/index";

const buildGallery = () => {
  const container = document.createElement("div");
  container.innerHTML = `
    <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a">
      <img src="./a.jpg" alt="A" />
    </a>
    <a href="./large-b.jpg" class="js-smartphoto" data-caption="B" data-id="b">
      <img src="./b.jpg" alt="B" />
    </a>
  `;
  document.body.appendChild(container);
  return container;
};

const openViewer = async (container: HTMLElement) => {
  fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
  await waitFor(() => {
    expect(document.querySelector("dialog.smartphoto")).toHaveAttribute("open");
  });
};

describe("公開メソッド契約", () => {
  let container: HTMLElement;
  let smartPhoto: SmartPhoto | undefined;

  beforeEach(() => {
    container = buildGallery();
    smartPhoto = new SmartPhoto(".js-smartphoto");
  });

  afterEach(() => {
    smartPhoto?.destroy();
    container.remove();
    document.querySelectorAll("dialog.smartphoto").forEach((d) => {
      d.remove();
    });
  });

  it("hidePhoto() は開いている状態でのみ閉じる(冪等)", async () => {
    await openViewer(container);
    smartPhoto?.hidePhoto();
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
    expect(() => smartPhoto?.hidePhoto()).not.toThrow();
  });

  it("addNewItem(element) で新しいサムネイルを追加できる", async () => {
    const a = document.createElement("a");
    a.href = "./large-c.jpg";
    a.className = "js-smartphoto";
    a.setAttribute("data-caption", "C");
    a.setAttribute("data-id", "c");
    const img = document.createElement("img");
    img.src = "./c.jpg";
    a.appendChild(img);
    container.appendChild(a);

    smartPhoto?.addNewItem(a);
    fireEvent.click(a);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "C",
      );
    });
  });

  it("destroy() は dialog を DOM から除去する", () => {
    expect(document.querySelector("dialog.smartphoto")).toBeInTheDocument();
    smartPhoto?.destroy();
    expect(document.querySelector("dialog.smartphoto")).not.toBeInTheDocument();
  });

  it("destroy() は開いたまま呼んでも dialog を確実に閉じる", async () => {
    // 背景スクロールの抑制は :root:has(dialog.smartphoto[open]) という CSS だけで
    // 行っており、dialog.open の状態にのみ依存する(§)。destroy() 中に dialog.open
    // が false に戻ることを確認すれば、開いたままの背景スクロール抑制が確実に
    // 解除されることの検証になる
    await openViewer(container);
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    smartPhoto?.destroy();
    expect(dialog.open).toBe(false);
  });

  it("destroy() 後はイベントリスナーが解除される(サムネイルクリックが無反応になる)", async () => {
    smartPhoto?.destroy();
    fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelector("dialog.smartphoto")).not.toBeInTheDocument();
  });

  it("2回 destroy() を呼んでも例外を投げない", () => {
    smartPhoto?.destroy();
    expect(() => smartPhoto?.destroy()).not.toThrow();
  });
});
