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

  // スライドを送ると、その200ms後に近傍画像のプリロードが走る。ユーザーが
  // 送った直後(プリロード完了前)にスワイプや背景クリックで閉じた場合、遅れて
  // 解決したプリロードによってビューアが勝手に開き直らないことを保証する
  // (「最後のスライドまで送って閉じても閉じられない」として報告された不具合)
  it("送りの直後に閉じたら、遅れて完了する画像プリロードでビューアが再オープンしない", async () => {
    await openViewer(container);

    // 実機のレース(閉じた後にプリロードが解決する)を再現するため、
    // 以降の画像ロードは完了タイミングを手動で制御する
    const pending: Array<() => void> = [];
    class DeferredImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 0;
      height = 0;
      #src = "";
      get src(): string {
        return this.#src;
      }
      set src(value: string) {
        this.#src = value;
        if (!value) {
          return;
        }
        pending.push(() => {
          this.width = 800;
          this.height = 600;
          this.onload?.();
        });
      }
    }
    vi.stubGlobal("Image", DeferredImage);

    try {
      smartPhoto?.next();
      // slideList() のプリロード開始(200ms後)を待つ
      await waitFor(() => {
        expect(pending.length).toBeGreaterThan(0);
      });

      smartPhoto?.hide();
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
          "open",
        );
      });

      // 閉じた後にプリロードを完了させる
      for (const resolve of pending.splice(0)) {
        resolve();
      }
      // Promise.all().then() の再オープン処理が走りうるところまでキューを進める
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // jsdom は CSS トランジションを実行しないため transitionend は一切発火しない。
  // これは実ブラウザで閉じる演出が中断されるケース(閉じた直後の再オープン、
  // タブ非表示、reduced-motion 等)と同じ状況であり、その際に doHideEffect() が
  // li(fit/fillのスケールが掛からない、スライド送り用の外側要素)に設定した
  // translateY が残留しないことを保証する
  it("閉じる演出が中断されても、再度開いたときに li へ閉じ演出の transform が残らない", async () => {
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 800,
      configurable: true,
    });
    try {
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
      const li = document.querySelector(
        ".smartphoto-list li.current",
      ) as HTMLElement;
      // 閉じ演出の Y オフセット(800px)が残らず、通常の(Y=0の)位置に戻っている
      expect(li.style.transform).toBe("translate(0px,0px)");
    } finally {
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("transitionend が発火しなくても、閉じた後にフォールバックで transform が解除され close イベントが発火する", async () => {
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 800,
      configurable: true,
    });
    try {
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
      const li = document.querySelector(
        ".smartphoto-list li.current",
      ) as HTMLElement;
      fireEvent.click(
        document.querySelector(".smartphoto-dismiss") as HTMLElement,
      );
      expect(li.style.transform).toBe("translate(0px,800px)");
      await waitFor(
        () => {
          expect(
            document.querySelector("dialog.smartphoto"),
          ).not.toHaveAttribute("open");
          expect(handler).toHaveBeenCalledTimes(1);
        },
        { timeout: 2000 },
      );
    } finally {
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
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
    // 実ブラウザの通常経路: transitionend が先に発火して後始末が完了する
    fireEvent.transitionEnd(dialog);
    await waitFor(() => {
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
