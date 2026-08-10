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
    <a href="./large-c.jpg" class="js-smartphoto" data-caption="C" data-id="c">
      <img src="./c.jpg" alt="C" />
    </a>
  `;
  document.body.appendChild(container);
  return container;
};

const openViewer = async (container: HTMLElement, index = 0) => {
  const anchors = container.querySelectorAll(".js-smartphoto");
  fireEvent.click(anchors[index] as HTMLElement);
  await waitFor(() => {
    expect(document.querySelector("dialog.smartphoto")).toHaveAttribute("open");
  });
};

const caption = () =>
  document.querySelector(".smartphoto-caption")?.textContent;

describe("ナビゲーション", () => {
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

  it("次へ矢印クリックで次のスライドへ進む", async () => {
    await openViewer(container, 0);
    fireEvent.click(
      document.querySelector(".smartphoto-arrow-right button") as HTMLElement,
    );
    await waitFor(() => expect(caption()).toBe("B"));
  });

  it("前へ矢印クリックで前のスライドへ戻る", async () => {
    await openViewer(container, 1);
    fireEvent.click(
      document.querySelector(".smartphoto-arrow-left button") as HTMLElement,
    );
    await waitFor(() => expect(caption()).toBe("A"));
  });

  it("ナビのサムネイルクリックで該当スライドへ移動する", async () => {
    await openViewer(container, 0);
    const thumbnails = document.querySelectorAll(".smartphoto-nav button");
    fireEvent.click(thumbnails[2] as HTMLElement);
    await waitFor(() => expect(caption()).toBe("C"));
  });

  it("gotoSlide(index) で直接移動できる", async () => {
    await openViewer(container, 0);
    smartPhoto?.gotoSlide(2);
    await waitFor(() => expect(caption()).toBe("C"));
  });

  it("先頭では前へ矢印が操作不可(aria-hidden)になる", async () => {
    await openViewer(container, 0);
    expect(document.querySelector(".smartphoto-arrow-left")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("末尾では次へ矢印が操作不可(aria-hidden)になる", async () => {
    await openViewer(container, 2);
    expect(document.querySelector(".smartphoto-arrow-right")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("change イベントはスライドが変わったときだけ発火する", async () => {
    const handler = vi.fn();
    smartPhoto?.on("change", handler);
    await openViewer(container, 0);
    smartPhoto?.gotoSlide(1);
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    smartPhoto?.gotoSlide(1);
    await new Promise((r) => setTimeout(r, 250));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
