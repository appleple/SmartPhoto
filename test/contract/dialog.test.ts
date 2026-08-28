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

describe("dialog ライフサイクル", () => {
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

  it("サムネイルクリックで開く", async () => {
    await openViewer(container);
  });

  it("閉じるボタンで閉じる", async () => {
    await openViewer(container);
    fireEvent.click(
      document.querySelector(".smartphoto-dismiss") as HTMLElement,
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
  });

  it("ESC キーで閉じる", async () => {
    await openViewer(container);
    fireEvent.keyDown(document, { key: "Escape", keyCode: 27 });
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
  });

  it("背景クリックで閉じる", async () => {
    await openViewer(container);
    fireEvent.click(
      document.querySelector(".smartphoto-content") as HTMLElement,
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
  });

  it("2巡(開→閉→開)しても正しく開閉できる", async () => {
    await openViewer(container);
    fireEvent.click(
      document.querySelector(".smartphoto-dismiss") as HTMLElement,
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
    await openViewer(container);
  });

  // jsdom は CSS トランジションを実行しないため transitionend は一切発火しない。
  // これは実ブラウザで閉じる演出が中断されるケース(閉じた直後の再オープン、
  // タブ非表示、reduced-motion 等)と同じ状況であり、その際に doHideEffect() が
  // 設定した translateY が画像に残留しないことを保証する
  it("閉じる演出が中断されても、再度開いたときに画像へ閉じ演出の transform が残らない", async () => {
    await openViewer(container);
    fireEvent.click(
      document.querySelector(".smartphoto-dismiss") as HTMLElement,
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
    await openViewer(container);
    const img = document.querySelector(".smartphoto-img") as HTMLImageElement;
    expect(img.style.transform).not.toContain("translateY");
  });

  it("transitionend が発火しなくても、閉じた後にフォールバックで transform が解除され close イベントが発火する", async () => {
    const handler = vi.fn();
    await openViewer(container);
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;
    // dialog.close() モックが発するネイティブ close イベントと区別するため、
    // 公開 CustomEvent(detail を持つ)だけを数える
    dialog.addEventListener("close", (e) => {
      if (e instanceof CustomEvent) {
        handler();
      }
    });
    fireEvent.click(
      document.querySelector(".smartphoto-dismiss") as HTMLElement,
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
    const img = document.querySelector(".smartphoto-img") as HTMLImageElement;
    expect(img.style.transform).toContain("translateY");
    await waitFor(
      () => {
        expect(img.style.transform).not.toContain("translateY");
        expect(handler).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 },
    );
  });

  it("transitionend発火後にフォールバックのタイムアウトが後から発火しても二重に後始末しない", async () => {
    const handler = vi.fn();
    await openViewer(container);
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;
    dialog.addEventListener("close", (e) => {
      if (e instanceof CustomEvent) {
        handler();
      }
    });
    fireEvent.click(
      document.querySelector(".smartphoto-dismiss") as HTMLElement,
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
    const img = document.querySelector(".smartphoto-img") as HTMLImageElement;
    // 実ブラウザの通常経路: transitionend が先に発火して後始末が完了する
    fireEvent.transitionEnd(dialog);
    await waitFor(() => {
      expect(img.style.transform).not.toContain("translateY");
      expect(handler).toHaveBeenCalledTimes(1);
    });
    // フォールバックのタイムアウトが後から発火しても、finishHideEffect による
    // ガードのおかげで後始末は再実行されず close も増えない
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("dialog.showModal() の二重呼び出しで例外が起きない(open→open)", async () => {
    await openViewer(container);
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;
    expect(() => {
      if (!dialog.open) {
        dialog.showModal();
      }
    }).not.toThrow();
  });

  // ホスト側 CSS に `dialog { display: block; }` のような Bootstrap4 reboot.css
  // 系の互換ルールが読み込まれていると、ブラウザ標準の dialog:not([open]) の
  // display:none が上書きされ、閉じている dialog が画面全体に残ってクリックを
  // 吸収し続ける不具合があった。CSS 側のフォールバック(詳細度を上げた
  // dialog.smartphoto:not([open]))に加え、JS 側でも style.display を
  // 開閉に合わせて管理していることを保証する
  it("初期化直後(閉じている状態)は style.display が none になっている", () => {
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;
    expect(dialog.style.display).toBe("none");
  });

  it("開いている間は style.display の none が解除される", async () => {
    await openViewer(container);
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;
    expect(dialog.style.display).not.toBe("none");
  });

  it("閉じると style.display が none に戻る", async () => {
    await openViewer(container);
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;
    fireEvent.click(
      document.querySelector(".smartphoto-dismiss") as HTMLElement,
    );
    await waitFor(() => {
      expect(dialog).not.toHaveAttribute("open");
    });
    expect(dialog.style.display).toBe("none");
  });

  it("open イベントが発火する", async () => {
    const handler = vi.fn();
    smartPhoto?.on("open", handler);
    await openViewer(container);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("close イベントが発火する", async () => {
    const handler = vi.fn();
    smartPhoto?.on("close", handler);
    await openViewer(container);
    fireEvent.click(
      document.querySelector(".smartphoto-dismiss") as HTMLElement,
    );
    await waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
