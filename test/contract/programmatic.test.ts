import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import SmartPhoto from "../../src/index";

const slides = [
  { src: "/bear-large.jpg", thumb: "/bear.jpg", caption: "bear", id: "bear" },
  {
    src: "/camel-large.jpg",
    thumb: "/camel.jpg",
    caption: "camel",
    id: "camel",
    width: 1200,
    height: 800,
  },
];

describe("プログラマブル API(データソースモード, §3)", () => {
  let smartPhoto: SmartPhoto | undefined;

  afterEach(() => {
    smartPhoto?.destroy();
    document.querySelectorAll("dialog.smartphoto").forEach((d) => {
      d.remove();
    });
  });

  it("配列を渡して構築できる(DOM には触れない)", () => {
    smartPhoto = new SmartPhoto(slides);
    expect(document.querySelector("dialog.smartphoto")).toBeInTheDocument();
    expect(document.querySelectorAll(".smartphoto-list > li").length).toBe(2);
  });

  it("width/height を指定すると計測用の Image ロードを行わずに開ける", async () => {
    const originalImage = window.Image;
    const imageSpy = vi.fn(() => new originalImage());
    window.Image = imageSpy as unknown as typeof window.Image;
    try {
      smartPhoto = new SmartPhoto(slides);
      smartPhoto.show("camel");
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      expect(imageSpy).not.toHaveBeenCalled();
    } finally {
      window.Image = originalImage;
    }
  });

  it("show(index) で index 指定で開ける", async () => {
    smartPhoto = new SmartPhoto(slides);
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "bear",
      );
    });
  });

  it("show(id) で id 指定で開ける", async () => {
    smartPhoto = new SmartPhoto(slides);
    smartPhoto.show("camel");
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "camel",
      );
    });
  });

  it("next()/prev() で移動し、端では何もしない", async () => {
    smartPhoto = new SmartPhoto(slides);
    smartPhoto.show(0);
    // caption は index0("bear")では構築時の初期描画と偶然一致するため、
    // 開く処理(非同期)が確実に完了したことを dialog の open 属性で確認する
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
      "bear",
    );
    smartPhoto.next();
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "camel",
      );
    });
    smartPhoto.next();
    await new Promise((r) => setTimeout(r, 250));
    expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
      "camel",
    );
    smartPhoto.prev();
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "bear",
      );
    });
  });

  it("hide() で閉じる", async () => {
    smartPhoto = new SmartPhoto(slides);
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    smartPhoto.hide();
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
  });

  it("currentIndex は現在の表示位置を返す", async () => {
    smartPhoto = new SmartPhoto(slides);
    expect(smartPhoto.currentIndex).toBe(0);
    smartPhoto.show(1);
    await waitFor(() => expect(smartPhoto?.currentIndex).toBe(1));
  });

  it("addItem(slide) で配列モードにアイテムを追加できる", async () => {
    smartPhoto = new SmartPhoto(slides);
    smartPhoto.addItem({ src: "/lion-large.jpg", caption: "lion", id: "lion" });
    smartPhoto.show("lion");
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "lion",
      );
    });
  });

  it("trigger 指定時はその要素へフォーカスが復帰する", async () => {
    smartPhoto = new SmartPhoto(slides);
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    smartPhoto.show(0, { trigger });
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    smartPhoto.hide();
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
    trigger.remove();
  });

  it("trigger 無指定時は show() 呼び出し時の activeElement へフォーカスが復帰する", async () => {
    smartPhoto = new SmartPhoto(slides);
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    smartPhoto.hide();
    await waitFor(() => {
      expect(document.activeElement).toBe(button);
    });
    button.remove();
  });

  it("on() で登録したイベントは両モード共通で動作する", async () => {
    smartPhoto = new SmartPhoto(slides);
    const handler = vi.fn();
    smartPhoto.on("open", handler);
    smartPhoto.show(0);
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
  });

  it("HTML モードでも show() でプログラム的に開ける", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a">
        <img src="./a.jpg" alt="A" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    container.remove();
  });

  it("HTML モードでもサムネイルクリックは従来どおり機能する(完全互換)", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a">
        <img src="./a.jpg" alt="A" />
      </a>
    `;
    document.body.appendChild(container);
    smartPhoto = new SmartPhoto(".js-smartphoto");
    fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    container.remove();
  });
});
