import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import SmartPhoto from "../../src/index";

declare global {
  interface Window {
    __xssFired?: boolean;
  }
}

describe("XSS 安全性(§6.4)", () => {
  let container: HTMLElement | undefined;
  let smartPhoto: SmartPhoto | undefined;

  afterEach(() => {
    smartPhoto?.destroy();
    container?.remove();
    container = undefined;
    smartPhoto = undefined;
    document.querySelectorAll("dialog.smartphoto").forEach((d) => {
      d.remove();
    });
    window.__xssFired = undefined;
  });

  it("HTML ソースモード: data-caption に含まれる HTML は実行されない", async () => {
    container = document.createElement("div");
    const payload = '<img src=x onerror="window.__xssFired = true">';
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="${payload.replaceAll('"', "&quot;")}" data-id="a">
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

    expect(window.__xssFired).toBeUndefined();
    expect(document.querySelector(".smartphoto-caption img")).toBeNull();
    expect(
      document.querySelector(".smartphoto-caption")?.textContent,
    ).toContain("<img");
  });

  it("データソースモード: caption/alt に含まれる HTML は実行されない", async () => {
    smartPhoto = new SmartPhoto([
      {
        src: "/large.jpg",
        caption: '<img src=x onerror="window.__xssFired = true">',
        alt: '"><script>window.__xssFired = true</script>',
        width: 800,
        height: 600,
      },
    ]);
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });

    expect(window.__xssFired).toBeUndefined();
    expect(document.querySelector(".smartphoto-caption img")).toBeNull();
    expect(document.querySelector(".smartphoto-caption script")).toBeNull();
  });

  it("ナビの thumb URL に引用符・HTML を含めても DOM に注入されない", async () => {
    smartPhoto = new SmartPhoto([
      {
        src: "/large.jpg",
        thumb: '"><img src=x onerror="window.__xssFired=true">',
        width: 800,
        height: 600,
      },
      { src: "/large2.jpg", width: 800, height: 600 },
    ]);
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });

    expect(window.__xssFired).toBeUndefined();
    expect(document.querySelector(".smartphoto-nav img")).toBeNull();
  });

  it("href/src に javascript: を含めても img.src としてそのまま設定されるだけで実行されない", async () => {
    smartPhoto = new SmartPhoto([
      { src: "javascript:window.__xssFired=true", width: 10, height: 10 },
    ]);
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(window.__xssFired).toBeUndefined();
  });
});
