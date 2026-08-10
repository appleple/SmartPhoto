import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("イベント契約", () => {
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

  it("on() は dialog 要素を this として handler を呼ぶ", async () => {
    const handler = vi.fn();
    smartPhoto?.on("open", handler);
    await openViewer(container);
    const dialog = document.querySelector("dialog.smartphoto");
    expect(handler.mock.instances[0]).toBe(dialog);
  });

  it("open/close イベントが発火する", async () => {
    const open = vi.fn();
    const close = vi.fn();
    smartPhoto?.on("open", open);
    smartPhoto?.on("close", close);
    await openViewer(container);
    expect(open).toHaveBeenCalledTimes(1);
    smartPhoto?.hidePhoto();
    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });

  it("zoomin/zoomout イベントが発火する", async () => {
    // jsdom は documentElement.clientWidth/Height が既定で 0 のため、
    // ズーム倍率の計算が意味を持つよう現実的なビューポートと、画面より大きい画像に差し替える
    const originalWidth = Object.getOwnPropertyDescriptor(
      document.documentElement,
      "clientWidth",
    );
    const originalHeight = Object.getOwnPropertyDescriptor(
      document.documentElement,
      "clientHeight",
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 768,
      configurable: true,
    });
    const OriginalImage = window.Image;
    class LargeImageMock {
      onload: (() => void) | null = null;
      width = 0;
      height = 0;
      set src(_value: string) {
        queueMicrotask(() => {
          this.width = 4000;
          this.height = 3000;
          this.onload?.();
        });
      }
    }
    window.Image = LargeImageMock as unknown as typeof window.Image;

    try {
      const zoomin = vi.fn();
      const zoomout = vi.fn();
      smartPhoto?.on("zoomin", zoomin);
      smartPhoto?.on("zoomout", zoomout);
      await openViewer(container);
      smartPhoto?.zoomPhoto();
      await waitFor(() => expect(zoomin).toHaveBeenCalledTimes(1));
      smartPhoto?.zoomOutPhoto();
      expect(zoomout).toHaveBeenCalledTimes(1);
    } finally {
      if (originalWidth) {
        Object.defineProperty(
          document.documentElement,
          "clientWidth",
          originalWidth,
        );
      }
      if (originalHeight) {
        Object.defineProperty(
          document.documentElement,
          "clientHeight",
          originalHeight,
        );
      }
      window.Image = OriginalImage;
    }
  });

  it("loadall イベントはグループ内の全画像ロード完了時に1回だけ発火する", async () => {
    const loadall = vi.fn();
    smartPhoto?.on("loadall", loadall);
    await openViewer(container);
    expect(loadall).not.toHaveBeenCalled();

    // 隣接アイテムのプリロード(loadOffset)経由で残りの画像も読み込まれる
    smartPhoto?.gotoSlide(1);
    await waitFor(() => expect(loadall).toHaveBeenCalledTimes(1));

    await new Promise((r) => setTimeout(r, 250));
    expect(loadall).toHaveBeenCalledTimes(1);
  });
});
