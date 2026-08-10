import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SmartPhoto from "../../src/index";
import ImportedDefault from "../../src/index";

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

describe("constructor(HTMLソースモード)", () => {
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
  });

  it("default export はクラスである", () => {
    expect(typeof ImportedDefault).toBe("function");
  });

  it("CSS セレクタ文字列を受け取れる", () => {
    smartPhoto = new SmartPhoto(".js-smartphoto");
    expect(document.querySelector("dialog.smartphoto")).toBeInTheDocument();
  });

  it("NodeList を受け取れる", () => {
    smartPhoto = new SmartPhoto(document.querySelectorAll(".js-smartphoto"));
    expect(document.querySelector("dialog.smartphoto")).toBeInTheDocument();
  });

  it("既定オプションで矢印・ナビが有効になる", () => {
    smartPhoto = new SmartPhoto(".js-smartphoto");
    expect(document.querySelector(".smartphoto-arrows")).toBeInTheDocument();
    expect(document.querySelector(".smartphoto-nav")).toBeInTheDocument();
  });

  it("arrows/nav を false にすると該当要素が生成されない", () => {
    smartPhoto = new SmartPhoto(".js-smartphoto", {
      arrows: false,
      nav: false,
    });
    expect(
      document.querySelector(".smartphoto-arrows"),
    ).not.toBeInTheDocument();
    expect(document.querySelector(".smartphoto-nav")).not.toBeInTheDocument();
  });

  it("message オプションでスクリーンリーダー文言を上書きできる", () => {
    smartPhoto = new SmartPhoto(".js-smartphoto", {
      message: {
        gotoNextImage: "Next Image",
        gotoPrevImage: "Previous Image",
        closeDialog: "Close Dialog",
      },
    });
    const dismissText = document.querySelector(
      ".smartphoto-dismiss .smartphoto-sr-only",
    );
    expect(dismissText?.textContent).toBe("Close Dialog");
  });

  it("classNames オプションでクラス名を上書きできる", () => {
    smartPhoto = new SmartPhoto(".js-smartphoto", {
      classNames: { smartPhoto: "custom-photo" },
    });
    expect(document.querySelector("dialog.custom-photo")).toBeInTheDocument();
  });

  it("複数インスタンスが独立して構築できる", () => {
    const other = buildGallery();
    smartPhoto = new SmartPhoto(".js-smartphoto");
    const second = new SmartPhoto(other.querySelectorAll(".js-smartphoto"));
    expect(document.querySelectorAll("dialog.smartphoto").length).toBe(2);
    second.destroy();
    other.remove();
  });
});
