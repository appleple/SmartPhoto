import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SmartPhoto from "../../src/index";

const buildGallery = () => {
  const container = document.createElement("div");
  container.innerHTML = `
    <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g">
      <img src="./a.jpg" alt="A" />
    </a>
    <a href="./large-b.jpg" class="js-smartphoto" data-caption="B" data-id="b" data-group="g">
      <img src="./b.jpg" alt="B" />
    </a>
  `;
  document.body.appendChild(container);
  return container;
};

describe("URL ハッシュ契約", () => {
  let container: HTMLElement;
  let smartPhoto: SmartPhoto | undefined;

  beforeEach(() => {
    container = buildGallery();
  });

  afterEach(() => {
    smartPhoto?.destroy();
    container.remove();
    document.querySelectorAll("dialog.smartphoto").forEach((d) => {
      d.remove();
    });
    window.history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}`,
    );
  });

  it("開くと #group=…&photo=… がハッシュに設定される", async () => {
    smartPhoto = new SmartPhoto(".js-smartphoto");
    fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
    await waitFor(() => {
      expect(location.hash).toBe("#group=g&photo=a");
    });
  });

  it("閉じるとハッシュがクリアされる", async () => {
    smartPhoto = new SmartPhoto(".js-smartphoto");
    fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(location.hash).toBe("#group=g&photo=a");
    smartPhoto.hidePhoto();
    expect(location.hash).toBe("");
  });

  it("ハッシュが一致するアイテムがあれば構築時に自動で開く", async () => {
    window.history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}#group=g&photo=b`,
    );
    smartPhoto = new SmartPhoto(".js-smartphoto");
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
      "B",
    );
  });

  it("useHistoryApi: false のときはハッシュを更新しない", async () => {
    smartPhoto = new SmartPhoto(".js-smartphoto", { useHistoryApi: false });
    fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(location.hash).toBe("");
  });
});
