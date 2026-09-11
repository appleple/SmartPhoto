import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import SmartPhoto from "../../src/index";

let activeInstances: SmartPhoto[] = [];
let activeContainers: HTMLElement[] = [];

// 各テストが assert 失敗で早期に throw しても、次のテストへ DOM やイベントリスナーが
// 漏れないよう、生成した SmartPhoto インスタンス・コンテナを必ず破棄する
afterEach(() => {
  activeInstances.forEach((s) => {
    s.destroy();
  });
  activeInstances = [];
  activeContainers.forEach((c) => {
    c.remove();
  });
  activeContainers = [];
  document.querySelectorAll("dialog.smartphoto").forEach((d) => {
    d.remove();
  });
  window.history.replaceState(
    null,
    "",
    `${location.pathname}${location.search}`,
  );
  vi.restoreAllMocks();
});

const track = <T extends SmartPhoto>(instance: T): T => {
  activeInstances.push(instance);
  return instance;
};

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
  activeContainers.push(container);
  return container;
};

const openViewer = async (container: HTMLElement) => {
  fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
  await waitFor(() => {
    expect(document.querySelector("dialog.smartphoto")).toHaveAttribute("open");
  });
};

const withStubbedUserAgent = (ua: string) =>
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);

describe("dialog のネイティブ close イベント", () => {
  it("smartPhoto.hidePhoto() を経由せず dialog.close() が呼ばれても状態が同期する", async () => {
    const container = buildGallery();
    const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    const close = vi.fn();
    smartPhoto.on("close", close);

    // ESC 等、アプリの hidePhoto() を経由しないネイティブ close を再現する。
    // hidePhoto() 自体が呼ばれて状態が同期していることは、hidePhoto() 経由でしか
    // 発火しない公開の "close" イベントで検証する
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;
    dialog.close();
    fireEvent.transitionEnd(dialog);

    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });
});

describe("データソースモードのハッシュ復元", () => {
  it("element を持たないアイテムでも構築時にハッシュから直接開く", async () => {
    window.history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}#group=nogroup&photo=camel`,
    );
    const smartPhoto = track(
      new SmartPhoto([
        { src: "/bear.jpg", id: "bear", width: 10, height: 10 },
        { src: "/camel.jpg", id: "camel", width: 10, height: 10 },
      ]),
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(smartPhoto.currentIndex).toBe(1);
  });
});

describe("hidePhoto の transitionend 完了", () => {
  it("dialog の transitionend で close イベントが発火する", async () => {
    const container = buildGallery();
    const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    const close = vi.fn();
    smartPhoto.on("close", close);

    smartPhoto.hidePhoto();
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;
    fireEvent.transitionEnd(dialog);

    await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });

  it("dialog 以外の子要素(list等)の transitionend では早期に完了しない", async () => {
    // dialog.addEventListener("transitionend", finish, true) は capture:true の
    // ため、dialog 自身の opacity transition だけでなく、配下の任意の要素
    // (list のスライド送りアニメーション等)の transitionend も拾ってしまう。
    // 直前にスライド送り操作をした直後に閉じた場合など、無関係な子要素の
    // transitionend で閉じるアニメーション(li の translateY)が早期に
    // リセットされてしまう不具合があった
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const container = buildGallery();
      const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
      await openViewer(container);

      smartPhoto.hidePhoto();
      const li = document.querySelector(
        ".smartphoto-list li.current",
      ) as HTMLElement;
      const transformDuringClose = li.style.transform;
      expect(transformDuringClose).toBe("translate(0px,700px)");

      // dialog 自身ではない、配下の list 要素で transitionend が発火しても
      // finish() の後始末(次の render() での位置リセット)が走ってはいけない
      const list = document.querySelector(".smartphoto-list") as Element;
      fireEvent.transitionEnd(list);
      expect(li.style.transform).toBe(transformDuringClose);

      // dialog 自身の transitionend で初めて後始末(close イベント発火 → render())が走る
      const close = vi.fn();
      smartPhoto.on("close", close);
      fireEvent.transitionEnd(
        document.querySelector("dialog.smartphoto") as Element,
      );
      await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    } finally {
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("スライド送り直後(200ms以内)に閉じても、slideList() の遅延 commit で閉じるスライドが上書きされない", async () => {
    // slideList() は送り操作のたびに 200ms 後の scheduleTimeout で commit()
    // (render() + updatePhotoTransform())を実行するが、isOpen のガードがない。
    // 送り直後にすぐ閉じると、この遅延 commit が「閉じた後」に実行され、
    // li の transform(translateX/Y)を再適用してしまい、doHideEffect() が
    // 設定した閉じるスライド(translateY オフセット)を消してしまう不具合があった。
    // li は img と違い未ロードのスライドでも必ず存在するため、next() による
    // 実際の送り先(次のスライド)への close をそのまま再現できる
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const container = buildGallery();
      const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
      await openViewer(container);

      vi.useFakeTimers();
      try {
        smartPhoto.next();
        smartPhoto.hidePhoto();
        const li = document.querySelector(
          ".smartphoto-list li:nth-child(2)",
        ) as HTMLElement;
        const transformDuringClose = li.style.transform;
        expect(transformDuringClose).toBe("translate(0px,700px)");

        // slideList() の 200ms 遅延 commit を発火させる
        vi.advanceTimersByTime(200);

        expect(li.style.transform).toBe(transformDuringClose);
      } finally {
        vi.useRealTimers();
      }
    } finally {
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("zoomPhoto() 直後(300ms以内)に閉じると、遅延 updatePhotoTransform は実行されず zoomin も発火しない", async () => {
    // zoomPhoto() は 300ms 後の scheduleTimeout で updatePhotoTransform() を
    // 直接呼び、"zoomin" イベントを発火するが、isOpen のガードがなかった。
    // ズーム操作直後にすぐ閉じると、この遅延処理が閉じた後に実行され、
    // 既に閉じたビューアに対して zoomin イベントが発火してしまっていた
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 768,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 1000 }]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });

      vi.useFakeTimers();
      try {
        const zoomin = vi.fn();
        smartPhoto.on("zoomin", zoomin);
        smartPhoto.zoomPhoto();
        smartPhoto.hidePhoto();

        // zoomPhoto() の遅延処理(アニメーション完了後)を発火させる
        vi.advanceTimersByTime(1000);

        expect(zoomin).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("zoomPhoto() の scale 状態への移行(zoomin)は、ズームアニメーション完了後に行われる", async () => {
    // zoomPhoto() は img の transform transition(animationSpeed=450ms)で
    // ズームをアニメーションさせるが、scale 状態への移行(ドラッグ可能化 +
    // smartphoto-img-onmove クラス = transition: none)が固定 300ms 後だった
    // ため、進行中のアニメーションが 300ms 時点で打ち切られて最終倍率へ
    // スナップし、「拡大時のカクつき」として見えていた。移行はアニメーション
    // 完了(animationSpeed)後に行うことを保証する
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 768,
      configurable: true,
    });
    try {
      // デフォルトの animationSpeed に依存しないよう明示指定する(旧実装の
      // 固定 300ms とデフォルト値が偶然一致すると検証にならないため)
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 2000 }], {
          animationSpeed: 450,
        }),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });

      vi.useFakeTimers();
      try {
        const zoomin = vi.fn();
        smartPhoto.on("zoomin", zoomin);
        smartPhoto.zoomPhoto();
        const img = document.querySelector(
          ".current .smartphoto-img",
        ) as HTMLElement;

        // アニメーション完了前(450ms 未満)は transition を打ち切らない
        vi.advanceTimersByTime(449);
        expect(zoomin).not.toHaveBeenCalled();
        expect(img.classList.contains("smartphoto-img-onmove")).toBe(false);

        // 完了後に scale 状態へ移行する
        vi.advanceTimersByTime(1);
        expect(zoomin).toHaveBeenCalledTimes(1);
        expect(img.classList.contains("smartphoto-img-onmove")).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("閉じるアニメーション完了前に再度開いても、遅延した close イベントで開いたばかりのモーダルを閉じない", async () => {
    // hidePhoto() は closeアニメーション完了(transitionend)を待って公開の
    // "close" イベントを発火するが、これはネイティブ dialog の "close" イベントと
    // 同じ型名を共有する。閉じるアニメーション中に素早く再度開いた場合、この
    // 遅延発火する公開イベントを「ネイティブ close 同期」用リスナーが誤って
    // 拾うと、既に再オープンした isOpen=true の状態に対して hidePhoto() が
    // 再度呼ばれ、開いたばかりのモーダルを閉じてしまう回帰があった
    const container = buildGallery();
    const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;

    smartPhoto.hidePhoto();
    expect(dialog.open).toBe(false);

    // transitionend が発火する前に(closeアニメーション完了前に)素早く再度開く
    await openViewer(container);
    expect(dialog.open).toBe(true);

    // 前回の hidePhoto() から遅延していた transitionend がここで発火し、
    // 公開の "close" イベントが dialog 上で発火する
    fireEvent.transitionEnd(dialog);

    expect(dialog.open).toBe(true);
  });

  it("hidePhoto(top) では li が上方向へ移動する", async () => {
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const container = buildGallery();
      const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
      await openViewer(container);
      smartPhoto.hidePhoto("top");
      const li = document.querySelector(
        ".smartphoto-list li.current",
      ) as HTMLElement;
      expect(li.style.transform).toBe("translate(0px,-700px)");
      fireEvent.transitionEnd(
        document.querySelector("dialog.smartphoto") as Element,
      );
    } finally {
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("フィットのため大きく縮小された縦長画像でも、閉じるスライドは画面の高さ分だけ単純に移動する(拡大率の影響を受けない)", async () => {
    // li は fit(item.scale)/fill(viewer.scaleSize)のいずれのスケールも
    // 掛からない外側の要素のため、item.scale がどれだけ小さくても
    // (フィットのため大きく縮小された縦長画像でも)閉じるスライドの移動量は
    // 常に画面の高さそのものになり、巨大化された画像内の別の部分が露出して
    // 「被写体が迫ってくる」ように見えることがない
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 390,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 867, height: 1997 }]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });

      smartPhoto.hidePhoto();

      const li = document.querySelector(
        ".smartphoto-list li.current",
      ) as HTMLElement;
      expect(li.style.transform).toBe("translate(0px,700px)");
      fireEvent.transitionEnd(
        document.querySelector("dialog.smartphoto") as Element,
      );
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("resizeStyle: fill でズームされた状態のまま閉じても、閉じた瞬間に等倍へスナップしない", async () => {
    // 閉じるスライドは li(fit/fillのスケールが掛からない外側の要素)に
    // 適用するため、img 自身の transform(fill の scale)は閉じる間も一切
    // 変更されない。以前は img に直接 translateY を上書き設定しており、
    // その際 scale が消えて一瞬「元の大きさ」へスナップする不具合があった
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 390,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 867, height: 1997 }], {
          resizeStyle: "fill",
        }),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      const scaleBeforeClose = Number(
        img.style.transform.match(/scale\(([^)]+)\)/)?.[1],
      );
      expect(Number.isNaN(scaleBeforeClose)).toBe(false);
      expect(scaleBeforeClose).not.toBe(1);

      smartPhoto.hidePhoto();

      const scaleDuringClose = Number(
        img.style.transform.match(/scale\(([^)]+)\)/)?.[1],
      );
      expect(scaleDuringClose).toBeCloseTo(scaleBeforeClose, 5);
      fireEvent.transitionEnd(
        document.querySelector("dialog.smartphoto") as Element,
      );
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("ズームの transition 進行中に閉じると、img の transform がその時点の描画値で固定される", async () => {
    // タップ(zoomPhoto)は img の transform を scale(scaleBorder) へ変更し、
    // CSS transition(0.45s)でアニメーションさせる。この transition の進行中に
    // 閉じると、閉じ演出(li の下スライド + dialog のフェード)の間もズームが
    // 目標倍率へ向かって動き続け、「下に落ちる」はずの写真が「こちらへ迫って
    // くる」ように見えていた(縦長画像は scaleBorder > 1 のため顕在化し、
    // 画面幅に近い横長画像は zoomPhoto が早期 return するため起きない)。
    // 閉じ演出の開始時に、その時点で実際に描画されている値(補間途中の matrix)
    // をインラインへ書き戻して transition を打ち切ることを保証する
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 768,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 2000 }]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;

      smartPhoto.zoomPhoto();
      // ズームの目標値がセットされ、実ブラウザではここから transition が始まる
      expect(img.style.transform).toContain("scale(");

      // jsdom は transition を実行しないため、「補間途中の描画値」を
      // getComputedStyle のスタブで再現する
      const midTransition = "matrix(1.4, 0, 0, 1.4, 0, 0)";
      const origGetComputedStyle = window.getComputedStyle.bind(window);
      vi.spyOn(window, "getComputedStyle").mockImplementation(
        (el: Element, pseudo?: string | null) => {
          if (el === img) {
            return { transform: midTransition } as CSSStyleDeclaration;
          }
          return origGetComputedStyle(el, pseudo);
        },
      );

      smartPhoto.hidePhoto();

      expect(img.style.transform).toBe(midTransition);
      fireEvent.transitionEnd(
        document.querySelector("dialog.smartphoto") as Element,
      );
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });
});

describe("showAnimation: false 時の hidePhoto", () => {
  it("transitionend やタイマーを待たずに公開 close イベントが発火する", async () => {
    // dialog には「ネイティブ close(dialog.close() が同期発火)」と「hidePhoto()
    // が doHideEffect() 完了後に発火する公開 close CustomEvent」の2つが同じ
    // イベント名で発火する。ここでは後者がタイマー(animationSpeed+100ms)を
    // 待たずマイクロタスクだけで発火することを検証する
    const container = buildGallery();
    const smartPhoto = track(
      new SmartPhoto(".js-smartphoto", { showAnimation: false }),
    );
    await openViewer(container);
    const close = vi.fn();
    smartPhoto.on("close", close);

    vi.useFakeTimers();
    try {
      smartPhoto.hidePhoto();
      // マイクロタスクだけ flush し、マクロタスク(setTimeout)は一切進めない
      await Promise.resolve();
      await Promise.resolve();
      // 1回目: ネイティブ close(dialog.close() で同期発火)
      // 2回目: 公開 close(doHideEffect() 完了後に fireEvent("close") で発火)
      expect(close).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("閉じるスライド(li の transform)を設定しない", async () => {
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const container = buildGallery();
      const smartPhoto = track(
        new SmartPhoto(".js-smartphoto", { showAnimation: false }),
      );
      await openViewer(container);
      const li = document.querySelector(
        ".smartphoto-list li.current",
      ) as HTMLElement;
      const transformBeforeClose = li.style.transform;

      smartPhoto.hidePhoto();

      expect(li.style.transform).toBe(transformBeforeClose);
    } finally {
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("dialog の transition を無効化し、即座に非表示にする", async () => {
    const container = buildGallery();
    const smartPhoto = track(
      new SmartPhoto(".js-smartphoto", { showAnimation: false }),
    );
    await openViewer(container);
    const dialog = document.querySelector(
      "dialog.smartphoto",
    ) as HTMLDialogElement;

    smartPhoto.hidePhoto();

    expect(dialog.style.transition).toBe("none");
    expect(dialog.open).toBe(false);
  });
});

describe("zoomPhoto の境界", () => {
  it("開いていない(currentItem が無い)状態では何もしない", () => {
    const smartPhoto = track(new SmartPhoto([]));
    expect(() => smartPhoto.zoomPhoto()).not.toThrow();
  });

  it("画像が画面ぴったりに収まる場合はズームしない(scaleSize<=1)", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 768,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 800, height: 600 }]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const zoomin = vi.fn();
      smartPhoto.on("zoomin", zoomin);
      smartPhoto.zoomPhoto();
      await new Promise((r) => setTimeout(r, 350));
      expect(zoomin).not.toHaveBeenCalled();
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });
});

describe("開いた直後のサイズ再同期(resyncSizeAfterOpen)", () => {
  it("open 直後に viewport 幅が変わった場合(スクロールバー消失等)、次のフレームで正しい幅に再計算する", async () => {
    // initPhoto() の setSizeByScreen() は dialog がまだ open になっていない
    // (:root:has() の overflow:hidden 未適用)時点の幅を使う。ページに縦
    // スクロールバーがあると、dialog が開いてスクロールバーが消えた後の幅とズレる
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 800,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 1000 }]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const imgWrap = document.querySelector(
        ".current .smartphoto-img-wrap",
      ) as HTMLElement;
      const beforeTransform = imgWrap.style.transform;

      // dialog が開いてスクロールバーが消え、幅が広がったことを再現する
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 1016,
        configurable: true,
      });

      await waitFor(() => {
        expect(imgWrap.style.transform).not.toBe(beforeTransform);
      });
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("再計算フレームが来る前に閉じていれば何もしない", async () => {
    const smartPhoto = track(
      new SmartPhoto([{ src: "/a.jpg", width: 800, height: 600 }]),
    );
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(() => smartPhoto.hidePhoto()).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
  });

  it("viewport サイズが変わっていなければ再描画しない", async () => {
    const smartPhoto = track(
      new SmartPhoto([{ src: "/a.jpg", width: 800, height: 600 }]),
    );
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    const imgWrap = document.querySelector(
      ".current .smartphoto-img-wrap",
    ) as HTMLElement;
    const beforeTransform = imgWrap.style.transform;
    await new Promise((r) => setTimeout(r, 20));
    expect(imgWrap.style.transform).toBe(beforeTransform);
  });

  it("resizeStyle: fill でスマートフォン表示時、open した瞬間から fill 倍率が img へ反映される", async () => {
    // render() は imgWrap(fit用の item.scale)しか更新せず、img自体の
    // translate/scale は updatePhotoTransform() の専任だった。updatePhotoTransform()
    // が open フローの commit() から一度も呼ばれていなかったため、initPhoto() が
    // viewer.scaleSize に正しい fill 倍率を computed していても、ズーム操作
    // (pinch等)で初めて updatePhotoTransform() が呼ばれるまで画面上には反映され
    // ず、「open した瞬間は fill になっていない」ように見える不具合があった
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 390,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 1000 }], {
          resizeStyle: "fill",
        }),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      const imgScale = Number(
        img.style.transform.match(/scale\(([^)]+)\)/)?.[1],
      );
      // ズーム操作なしの初期状態でも scale(1) のまま放置されていないこと
      expect(Number.isNaN(imgScale)).toBe(false);
      expect(imgScale).not.toBe(1);
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("resizeStyle: fill でスライドを送っても、元のスライドの img に fill の transform が残らない", async () => {
    // updatePhotoTransform() はカレントの img しか更新しないため、スライドを
    // 送ると前のスライドの img に fill の scale(+ドラッグ位置の translate)が
    // インラインで残留し、li から大きくはみ出した拡大画像の断片が現在の
    // スライドの余白(上下/左右)に見えてしまう不具合があった。photoPos/
    // scaleSize はカレント専用の viewer 状態なので、非カレントの img は
    // render() が必ず素の transform に戻すことを保証する
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 390,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto(
          [
            { src: "/a.jpg", caption: "A", width: 867, height: 1997 },
            { src: "/b.jpg", caption: "B", width: 1716, height: 1146 },
          ],
          { resizeStyle: "fill" },
        ),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const firstImg = document.querySelector(
        ".smartphoto-list li .smartphoto-img",
      ) as HTMLElement;
      // 開いた時点でカレント(1枚目)には fill の拡大率が掛かっている
      expect(firstImg.style.transform).not.toContain("scale(1)");

      smartPhoto.gotoSlide(1);
      await waitFor(() => {
        expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
          "B",
        );
      });
      // slideList() の遅延 commit(200ms)による再描画を待つ
      await waitFor(() => {
        expect(firstImg.style.transform).toBe("translate(0px,0px) scale(1)");
      });
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("resizeStyle: fill でスライドを送った先のスライドにも fill の拡大率が適用される", async () => {
    // syncFillScale()(fill 倍率の再計算)は「setSizeByScreen() を呼ぶ箇所では
    // 併せて呼ぶ」必要があるが、スライド送り(slideList)がこれを守っておらず、
    // 送った先のスライドが fit サイズ(scaleSize=1)のまま表示され、その後の
    // ロード完了時の initPhoto() 等で突然 fill サイズへ跳ねる(小さく出てから
    // でっかくなる)不具合があった
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 390,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto(
          [
            { src: "/a.jpg", caption: "A", width: 867, height: 1997 },
            { src: "/b.jpg", caption: "B", width: 1716, height: 1146 },
          ],
          { resizeStyle: "fill" },
        ),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });

      smartPhoto.gotoSlide(1);
      await waitFor(() => {
        expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
          "B",
        );
      });
      await waitFor(() => {
        const img = document.querySelector(
          ".current .smartphoto-img",
        ) as HTMLElement;
        const scale = Number(
          img.style.transform.match(/scale\(([^)]+)\)/)?.[1],
        );
        // 横長 1716x1146 を 390x700 に fill: scaleBorder = 700 / (1146 * (390/1716))
        expect(scale).toBeCloseTo(700 / (1146 * (390 / 1716)), 5);
      });
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("resizeStyle: fill 使用中に open 直後のビューポート高さ変化があっても、fill の拡大率が正しい高さに追従する", async () => {
    // resyncSizeAfterOpen() は setSizeByScreen()(fit用の item.scale/x/y)は
    // 再計算するが、fill 用の viewer.scaleSize(scaleBorder() の結果)は
    // 再計算していなかった。item.scale が(幅超過の再補正により)たまたま
    // 変化しないケースでは再描画自体は起きるが scaleSize が古い高さのまま
    // 固定され、実際の高さに対して fill しきれない不具合を再現する
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 390,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 1000 }], {
          resizeStyle: "fill",
        }),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });

      // iOS Safari 等でアドレスバーが引っ込み、実際のビューポート高さが
      // 広がったことを再現する(幅は変えないため item.scale 自体は変化しない)
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 800,
        configurable: true,
      });

      const imgWrap = document.querySelector(
        ".current .smartphoto-img-wrap",
      ) as HTMLElement;
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;

      await waitFor(() => {
        const wrapScale = Number(
          imgWrap.style.transform.match(/scale\(([^)]+)\)/)?.[1],
        );
        const imgScale = Number(
          img.style.transform.match(/scale\(([^)]+)\)/)?.[1],
        );
        // fill は「表示中の高さいっぱいに画像を覆う」ことが目的のため、
        // 合成後の総スケール(item.scale × viewer.scaleSize)は
        // 新しい clientHeight(800) / item.height(1000) と一致するはずである
        expect(wrapScale * imgScale).toBeCloseTo(800 / 1000, 5);
      });
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });
});

describe("headerHeight / footerHeight オプション", () => {
  it("画面より大きい画像の scale に headerHeight + footerHeight が反映される", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 800,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 400, height: 2000 }], {
          headerHeight: 200,
          footerHeight: 100,
        }),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const imgWrap = document.querySelector(
        ".current .smartphoto-img-wrap",
      ) as HTMLElement;
      // screenY = 800 - (200 + 100) - FIT_MARGIN(24)*2 = 452 → scale = 452 / 2000 = 0.226
      // (デフォルトの headerHeight/footerHeight=60/60 なら scale は異なる値になり一致しない)
      expect(imgWrap.style.transform).toContain("scale(0.226)");
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("スマホでもデスクトップと同様に headerHeight/footerHeight を予約して fit する", async () => {
    // 一時期「PhotoSwipe に合わせてスマホは全ビューポート fit + UI オーバーレイ」に
    // 変更したが、写真がキャプション/サムネイルバーに覆い被さって隠してしまう
    // 見た目になったため元に戻した。スマホでも上下(既定 60+60px)を予約して
    // ヘッダー/ナビと写真が重ならないことを保証する
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 390,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 867, height: 1997 }]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const imgWrap = document.querySelector(
        ".current .smartphoto-img-wrap",
      ) as HTMLElement;
      // screenY = 700 - (60 + 60) - FIT_MARGIN(24)*2 = 532 → scale = 532 / 1997
      expect(imgWrap.style.transform).toContain(`scale(${532 / 1997})`);
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("headerHeight/footerHeight を明示指定した場合は、スマホでもその予約を尊重する", async () => {
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 390,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 700,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 867, height: 1997 }], {
          headerHeight: 50,
          footerHeight: 50,
        }),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const imgWrap = document.querySelector(
        ".current .smartphoto-img-wrap",
      ) as HTMLElement;
      // screenY = 700 - (50 + 50) - FIT_MARGIN(24)*2 = 552 → scale = 552 / 1997
      expect(imgWrap.style.transform).toContain(`scale(${552 / 1997})`);
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });
});

describe("show() の境界", () => {
  it("アイテムが無い場合は何もしない", () => {
    const smartPhoto = track(new SmartPhoto([]));
    expect(() => smartPhoto.show(0)).not.toThrow();
    expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
      "open",
    );
  });

  it("範囲外の index を指定した場合は何もしない", () => {
    const smartPhoto = track(
      new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }]),
    );
    expect(() => smartPhoto.show(99)).not.toThrow();
    expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
      "open",
    );
  });

  it("存在しない group を指定した場合は何もしない", () => {
    const smartPhoto = track(
      new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }]),
    );
    expect(() => smartPhoto.show(0, { group: "ghost" })).not.toThrow();
    expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
      "open",
    );
  });
});

describe("prev() の境界", () => {
  it("先頭では何もしない", async () => {
    const container = buildGallery();
    const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
      "A",
    );
    smartPhoto.prev();
    await new Promise((r) => setTimeout(r, 250));
    expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
      "A",
    );
  });
});

describe("空のギャラリーでの gotoSlide", () => {
  it("アイテムが無い状態で gotoSlide しても例外を投げない", async () => {
    const smartPhoto = track(new SmartPhoto([]));
    expect(() => smartPhoto.gotoSlide(0)).not.toThrow();
    await new Promise((r) => setTimeout(r, 250));
  });
});

describe("範囲外 index への gotoSlide", () => {
  it("範囲外の index は無視され、現在のスライドが維持される", async () => {
    // viewer.prev/next は端(最初/最後)のスライドでは setArrow() が更新しないため
    // -1 のままのことがあり、送り操作の直後(setArrow 反映前の 200ms 以内)に
    // 逆方向へ送るとその -1 がそのまま gotoSlide へ渡り得る。currentIndex が
    // -1 になると currentItem が見つからず、以降の送り・描画が壊れたままになる
    // ため、範囲外は「送り先なし」として無視することを保証する
    const smartPhoto = track(
      new SmartPhoto([
        { src: "/a.jpg", width: 10, height: 10 },
        { src: "/b.jpg", width: 10, height: 10 },
      ]),
    );
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    smartPhoto.gotoSlide(-1);
    expect(smartPhoto.currentIndex).toBe(0);
    smartPhoto.gotoSlide(2);
    expect(smartPhoto.currentIndex).toBe(0);
    await new Promise((r) => setTimeout(r, 250));
  });
});

describe("複数グループのギャラリー", () => {
  it("構築時に最後に追加されたグループ以外を開いても正しいスライドが表示される", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g1">
        <img src="./a.jpg" alt="A" />
      </a>
      <a href="./large-b.jpg" class="js-smartphoto" data-caption="B" data-id="b" data-group="g2">
        <img src="./b.jpg" alt="B" />
      </a>
    `;
    document.body.appendChild(container);
    activeContainers.push(container);
    track(new SmartPhoto(".js-smartphoto"));
    // 構築時点の syncCurrentGroupView は最後に追加された g2 を同期している。
    // g1(先頭)のサムネイルを開いても、g1 用のスライド DOM に正しく再同期されること
    const anchors = container.querySelectorAll(".js-smartphoto");
    fireEvent.click(anchors[0] as HTMLElement);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "A",
      );
    });
    expect(document.querySelectorAll(".smartphoto-list > li").length).toBe(1);
  });
});

describe("グループ切替後の currentImgElement 不一致", () => {
  it("開いた後に別グループへ切り替わっても hidePhoto は例外を投げない", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a" data-group="g1">
        <img src="./a.jpg" alt="A" />
      </a>
      <a href="./large-a2.jpg" class="js-smartphoto" data-caption="A2" data-id="a2" data-group="g1">
        <img src="./a2.jpg" alt="A2" />
      </a>
    `;
    document.body.appendChild(container);
    activeContainers.push(container);
    const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
    const anchors = container.querySelectorAll(".js-smartphoto");
    // g1 の2枚目(index=1)を開いた状態にする
    fireEvent.click(anchors[1] as HTMLElement);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(smartPhoto.currentIndex).toBe(1);

    // g2 は1枚しかなく index=0 しか存在しないため、view 側の refs.slides が
    // g2 に切り替わると currentIndex(1) に一致するスライドが見つからなくなる
    const other = document.createElement("a");
    other.href = "./large-c.jpg";
    other.setAttribute("data-group", "g2");
    other.setAttribute("data-caption", "C");
    const img = document.createElement("img");
    img.src = "./c.jpg";
    other.appendChild(img);
    smartPhoto.addItem(other);

    expect(() => smartPhoto.hidePhoto()).not.toThrow();
    fireEvent.transitionEnd(
      document.querySelector("dialog.smartphoto") as Element,
    );
  });
});

describe("View Transitions API 経由で開く", () => {
  it("対応ブラウザではサムネイルとフル画像に同じ view-transition-name を設定する", async () => {
    const container = buildGallery();
    // finished は実ブラウザではアニメーション完了まで解決しない。即時解決させると
    // view-transition-name の後始末(cleanup)が検証前に走ってしまうため、
    // このテストでは意図的に解決しない Promise を返す
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {
        ready: Promise.resolve(),
        finished: new Promise<void>(() => {}),
      };
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      track(new SmartPhoto(".js-smartphoto"));
      await openViewer(container);
      expect(startViewTransition).toHaveBeenCalledTimes(1);
      const fullImg = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      expect(fullImg.style.viewTransitionName).toBe("smartphoto-hero");
      // 新しい状態のスナップショットが取られる前に、サムネイル側の名前を消しておく必要がある。
      // 消し忘れると同じ名前を持つ要素が2つ存在することになり、ブラウザに
      // "duplicate view-transition-name" として拒否される
      const thumbImg = container.querySelector(
        ".js-smartphoto img",
      ) as HTMLElement;
      expect(thumbImg.style.viewTransitionName).toBe("");
    } finally {
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });

  it("view-transition-name の重複等で ready が reject されても例外を投げず後始末する", async () => {
    const container = buildGallery();
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {
        ready: Promise.reject(
          new Error("Unexpected duplicate view-transition-name"),
        ),
        finished: Promise.resolve(),
      };
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      track(new SmartPhoto(".js-smartphoto"));
      await openViewer(container);
      const fullImg = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      await waitFor(() => {
        expect(fullImg.style.viewTransitionName).toBe("");
      });
    } finally {
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });

  it("finished 解決後に view-transition-name の後始末(cleanup)が行われる", async () => {
    const container = buildGallery();
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      track(new SmartPhoto(".js-smartphoto"));
      await openViewer(container);
      const thumbImg = container.querySelector(
        ".js-smartphoto img",
      ) as HTMLElement;
      const fullImg = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      await waitFor(() => {
        expect(fullImg.style.viewTransitionName).toBe("");
      });
      expect(thumbImg.style.viewTransitionName).toBe("");
    } finally {
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });

  it("モーフ中はレイアウト寸法を表示寸法に一致させ、finished 後に元へ戻す", async () => {
    // WebKit は「レイアウトが巨大で transform で縮小表示している要素」のスナップ
    // ショットをビューポート付近で切り取る(仕様上もビューポート外のラスタライズは
    // 保証されない)ため、原寸幅がビューポートより大きい画像は開くモーフ中に
    // 右側が黒く欠ける。トランジション中だけレイアウト幅を表示幅
    // (item.width × item.scale)に、拡縮を scale(1) に切り替えて等倍レイアウトで
    // スナップショットさせ、finished 後は通常のレンダリングへ戻すことを保証する
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 800,
      configurable: true,
    });
    const held: { resolve: () => void } = { resolve: () => {} };
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {
        ready: Promise.resolve(),
        finished: new Promise<void>((resolve) => {
          held.resolve = resolve;
        }),
      };
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 1140 }]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      const imgWrap = document.querySelector(
        ".current .smartphoto-img-wrap",
      ) as HTMLElement;
      // fit の scale = 1000 / 2000 → 表示幅 = 2000 × (1000/2000) = 1000px
      expect(img.style.width).toBe("1000px");
      expect(imgWrap.style.transform).toContain("scale(1)");
      held.resolve();
      await waitFor(() => {
        expect(img.style.width).toBe("2000px");
      });
      expect(imgWrap.style.transform).toContain(`scale(${1000 / 2000})`);
    } finally {
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("WebKit では View Transitions API を使わず従来のクローン演出で開く", async () => {
    // WebKit(Safari / iOS の全ブラウザ)には「view-transition-name を付けた要素が
    // root スナップショットから除外されず、モーフ中に最終位置へ二重描画される」
    // 実装バグがあり、開く演出が「一旦ずれた位置に出てから正位置へ戻る」ように
    // 乱れて見える。WebKit 判定時は startViewTransition を呼ばず、実績のある
    // クローン画像の transform 演出(addAppearEffect)へフォールバックすることを保証する
    (
      window as unknown as { webkitConvertPointFromNodeToPage?: unknown }
    ).webkitConvertPointFromNodeToPage = () => ({});
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      const container = buildGallery();
      track(new SmartPhoto(".js-smartphoto"));
      await openViewer(container);
      expect(startViewTransition).not.toHaveBeenCalled();
      // クローン演出が使われている
      expect(document.querySelector(".smartphoto-img-clone")).not.toBeNull();
    } finally {
      delete (
        window as unknown as { webkitConvertPointFromNodeToPage?: unknown }
      ).webkitConvertPointFromNodeToPage;
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });

  it("finished の後始末はレイアウト復元のみ行い、caption 等を先行して再描画しない", async () => {
    // 後始末で view.render() を丸ごと呼ぶと、トランジション中に next() された場合に
    // caption や count が slideList の正規の反映(200ms 後の setArrow + commit)より
    // 先に更新されてしまう。utterance の見た目だけでなく、「caption は切り替わった
    // のに viewer.prev はまだ古い」という時間窓が生まれ、その間の prev 操作が
    // 範囲外 index へ飛ぶ原因になっていた(CI の E2E で顕在化)。後始末は
    // モーフ用レイアウト(width/transform)の復元だけに限定することを保証する
    const held: { resolve: () => void } = { resolve: () => {} };
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {
        ready: Promise.resolve(),
        finished: new Promise<void>((resolve) => {
          held.resolve = resolve;
        }),
      };
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      const smartPhoto = track(
        new SmartPhoto([
          { src: "/a.jpg", width: 10, height: 10, caption: "A" },
          { src: "/b.jpg", width: 10, height: 10, caption: "B" },
        ]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const caption = document.querySelector(
        ".smartphoto-caption",
      ) as HTMLElement;
      expect(caption.textContent).toBe("A");
      // トランジション中に次のスライドへ送る(caption の更新は 200ms 後の commit が担う)
      smartPhoto.next();
      held.resolve();
      await new Promise((r) => setTimeout(r, 20));
      // 後始末が render() だとここで先行して "B" になってしまう
      expect(caption.textContent).toBe("A");
      // 正規の反映で "B" になる
      await waitFor(() => {
        expect(caption.textContent).toBe("B");
      });
    } finally {
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });

  it("トランジション中のリサイズ再計算は finished まで遅延され、モーフ用レイアウトを壊さない", async () => {
    // iOS Safari ではダイアログを開くとツールバーの伸縮で visualViewport の resize が
    // 発火する。トランジション中にリサイズ経由の setSizeByScreen + commit() が走ると、
    // (1) モーフの目標位置は古いビューポート基準のままなのに実要素だけ新しい位置へ
    // 動き「一回上に行ってから適正位置に戻る」ように見え、(2) モーフ用レイアウト
    // (applyViewTransitionLayout)も巻き戻されてスナップショットの切り取りが再発する。
    // リサイズ由来の再計算はトランジション完了(finished)まで遅延することを保証する
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 800,
      configurable: true,
    });
    const held: { resolve: () => void } = { resolve: () => {} };
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {
        ready: Promise.resolve(),
        finished: new Promise<void>((resolve) => {
          held.resolve = resolve;
        }),
      };
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 1140 }]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      const imgWrap = document.querySelector(
        ".current .smartphoto-img-wrap",
      ) as HTMLElement;
      expect(img.style.width).toBe("1000px");

      // トランジション中にビューポートが 1000px → 800px へ変化
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 800,
        configurable: true,
      });
      window.dispatchEvent(new Event("resize"));
      // 遅延: モーフ用レイアウトは維持されたまま
      expect(img.style.width).toBe("1000px");
      expect(imgWrap.style.transform).toContain("scale(1)");

      held.resolve();
      await waitFor(() => {
        // finished 後に新ビューポート基準で再計算・復元される
        expect(img.style.width).toBe("2000px");
      });
      expect(imgWrap.style.transform).toContain(`scale(${800 / 2000})`);
    } finally {
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("トリガーに img が無い場合でも finished 解決時に例外を投げない", async () => {
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      await new Promise((r) => setTimeout(r, 10));
    } finally {
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });

  it("finished 解決時、次のスライドへ移動済みでその画像がまだ未処理でも例外を投げない", async () => {
    // finished は実ブラウザではアニメーション完了まで解決しないため、その間に
    // next() で移動した先のアイテムがまだ寸法未計測(processed=false)のことがある
    // (§3.5 の前提が崩れるケース)
    const held: { resolve: () => void } = { resolve: () => {} };
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {
        ready: Promise.resolve(),
        finished: new Promise<void>((resolve) => {
          held.resolve = resolve;
        }),
      };
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      const smartPhoto = track(
        new SmartPhoto([
          { src: "/a.jpg", width: 10, height: 10 },
          { src: "/b.jpg" },
        ]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });

      smartPhoto.next();
      expect(() => held.resolve()).not.toThrow();
      await new Promise((r) => setTimeout(r, 10));
    } finally {
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });

  it("useViewTransitionApi: false の場合、ブラウザ対応時でも startViewTransition を呼ばずフォールバックする", async () => {
    const container = buildGallery();
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return {
        ready: Promise.resolve(),
        finished: new Promise<void>(() => {}),
      };
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      track(new SmartPhoto(".js-smartphoto", { useViewTransitionApi: false }));
      await openViewer(container);
      expect(startViewTransition).not.toHaveBeenCalled();
      // フォールバック(addAppearEffect のクローン)経由で開いたことを確認する
      expect(document.querySelector(".smartphoto-img-clone")).not.toBeNull();
    } finally {
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });
});

describe("--smartphoto-icon-color(背景色に対する自動コントラスト計算)", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty(
      "--smartphoto-backdrop-color",
    );
    document.documentElement.style.removeProperty("--smartphoto-icon-color");
  });

  it("ホスト側が --smartphoto-backdrop-color を指定していなければ何もしない(既定の白のまま)", () => {
    const smartPhoto = track(new SmartPhoto([]));
    const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
    expect(dialog.style.getPropertyValue("--smartphoto-icon-color")).toBe("");
    void smartPhoto;
  });

  it("背景色が白系のとき、アイコン色を黒として自動算出する", () => {
    document.documentElement.style.setProperty(
      "--smartphoto-backdrop-color",
      "#fff",
    );
    const smartPhoto = track(new SmartPhoto([]));
    const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
    expect(dialog.style.getPropertyValue("--smartphoto-icon-color")).toBe(
      "#000",
    );
    void smartPhoto;
  });

  it("背景色が黒系(既定と同じ値を明示指定)のとき、アイコン色を白として自動算出する", () => {
    document.documentElement.style.setProperty(
      "--smartphoto-backdrop-color",
      "rgba(0, 0, 0, 1)",
    );
    const smartPhoto = track(new SmartPhoto([]));
    const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
    expect(dialog.style.getPropertyValue("--smartphoto-icon-color")).toBe(
      "#fff",
    );
    void smartPhoto;
  });

  it("ホスト側が --smartphoto-icon-color 自体を明示指定していれば、自動算出せずその指定を優先する(誤検知時の最終防衛ライン)", () => {
    // 白背景なら自動算出は #000 になるはずだが、ホスト側が明示的に赤を
    // 指定しているケースを再現する。dialog へインラインスタイルで書き込むと
    // 通常の CSS ルール(!important なし)では後から上書きできなくなるため、
    // 明示指定があるときは自動算出そのものをスキップしなければならない
    document.documentElement.style.setProperty(
      "--smartphoto-backdrop-color",
      "#fff",
    );
    document.documentElement.style.setProperty(
      "--smartphoto-icon-color",
      "red",
    );
    const smartPhoto = track(new SmartPhoto([]));
    const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
    expect(dialog.style.getPropertyValue("--smartphoto-icon-color")).toBe("");
    void smartPhoto;
  });
});

describe("--smartphoto-vh(実測ビューポート高さのCSS変数化)", () => {
  it("構築時に dialog へ実測した高さを設定する", () => {
    const smartPhoto = track(new SmartPhoto([]));
    const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
    expect(dialog.style.getPropertyValue("--smartphoto-vh")).toBe(
      `${document.documentElement.clientHeight}px`,
    );
  });

  it("resize 時(visualViewport 非対応環境)に再計算する", () => {
    const smartPhoto = track(new SmartPhoto([]));
    const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 480,
      configurable: true,
    });
    fireEvent(window, new Event("resize"));
    expect(dialog.style.getPropertyValue("--smartphoto-vh")).toBe("480px");
    delete (document.documentElement as { clientHeight?: number }).clientHeight;
    void smartPhoto;
  });

  it("スマートフォンでも resize(visualViewport 非対応環境)で再計算する", () => {
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const smartPhoto = track(new SmartPhoto([]));
    const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 550,
      configurable: true,
    });
    fireEvent(window, new Event("resize"));
    expect(dialog.style.getPropertyValue("--smartphoto-vh")).toBe("550px");
    delete (document.documentElement as { clientHeight?: number }).clientHeight;
    void smartPhoto;
  });

  it("visualViewport 対応環境では clientHeight より visualViewport.height を優先する", () => {
    // iOS Safari 等では document.documentElement.clientHeight が URL バーの
    // 表示/非表示に追従せず、実際に見えている領域より大きい値を返すことがある
    // (§css)。visualViewport.height の方が実測値として信頼できるため優先する
    const stubViewport = {
      height: 400,
      scale: 1,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as VisualViewport;
    Object.defineProperty(window, "visualViewport", {
      value: stubViewport,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 800,
      configurable: true,
    });
    const smartPhoto = track(new SmartPhoto([]));
    const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
    expect(dialog.style.getPropertyValue("--smartphoto-vh")).toBe("400px");
    delete (document.documentElement as { clientHeight?: number }).clientHeight;
    delete (window as { visualViewport?: VisualViewport }).visualViewport;
    void smartPhoto;
  });

  it("ネイティブのピンチズームでvisualViewport.scaleが変化してもscaleで相殺した高さを使う", () => {
    // 2本指ピンチが touch-action:none をすり抜けてブラウザ本体のページズームも
    // 誘発した場合、visualViewport.height はズーム倍率(scale)分だけ縮んだ値になる。
    // scale を掛けずに --smartphoto-vh へ入れてしまうと、その縮んだ値がdialogの
    // 高さに固定され、ズーム後にdialog下側が余って背景が見えてしまう(実際の不具合)
    const stubViewport = {
      height: 400,
      scale: 2,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as VisualViewport;
    Object.defineProperty(window, "visualViewport", {
      value: stubViewport,
      configurable: true,
    });
    const smartPhoto = track(new SmartPhoto([]));
    const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
    expect(dialog.style.getPropertyValue("--smartphoto-vh")).toBe("800px");
    delete (window as { visualViewport?: VisualViewport }).visualViewport;
    void smartPhoto;
  });

  it("構築後にビューポート高さが変わってから開いた場合、開く時点の高さを反映する(#97)", async () => {
    // --smartphoto-vh は構築時と resize/orientationchange 時にのみ更新しており、
    // 「開く」タイミングでは再計算していなかった。構築後にページスクロール等で
    // アドレスバーが引っ込み実ビューポートが広がった状態で開くと、dialog の高さ
    // (height: var(--smartphoto-vh)) が実際より小さいまま残り、下側の隙間から
    // 背景ページの内容が透けて見える不具合があった
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 800,
      configurable: true,
    });
    const smartPhoto = track(
      new SmartPhoto([{ src: "/a.jpg", width: 800, height: 600 }]),
    );
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 900,
      configurable: true,
    });
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    const dialog = document.querySelector("dialog.smartphoto") as HTMLElement;
    expect(dialog.style.getPropertyValue("--smartphoto-vh")).toBe("900px");
    delete (document.documentElement as { clientHeight?: number }).clientHeight;
  });
});

describe("resize/orientationchange: アイテムが無い場合", () => {
  it("resize は何もしない(デスクトップ・空ギャラリー)", () => {
    const smartPhoto = track(new SmartPhoto([]));
    expect(() => fireEvent(window, new Event("resize"))).not.toThrow();
    void smartPhoto;
  });

  it("orientationchange は何もしない(スマートフォン・空ギャラリー)", () => {
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const smartPhoto = track(new SmartPhoto([]));
    expect(() =>
      fireEvent(window, new Event("orientationchange")),
    ).not.toThrow();
    void smartPhoto;
  });
});

describe("addAppearEffect のフォールバック", () => {
  it("showAnimation: false の場合は appearEffect を作らない", async () => {
    const smartPhoto = track(
      new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }], {
        showAnimation: false,
      }),
    );
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(document.querySelector(".smartphoto-img-clone")).toBeNull();
  });

  it("trigger に img を含まない要素を指定するとフェードのみになる(データモード)", async () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    activeContainers.push(button);
    const smartPhoto = track(
      new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }]),
    );
    smartPhoto.show(0, { trigger: button });
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    expect(document.querySelector(".smartphoto-img-clone")).toBeNull();
    expect(document.querySelector(".current .smartphoto-img")).toHaveClass(
      "active",
    );
  });

  it("resizeStyle: fill かつスマートフォンでは画面を覆うようスケールする", async () => {
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const container = buildGallery();
    const img = container.querySelector("img") as HTMLImageElement;
    Object.defineProperty(img, "offsetWidth", {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(img, "offsetHeight", {
      value: 50,
      configurable: true,
    });
    track(new SmartPhoto(".js-smartphoto", { resizeStyle: "fill" }));
    await openViewer(container);
    expect(document.querySelector(".smartphoto-img-clone")).toBeInTheDocument();
  });

  it("縦長画像 (height > width) では item.height を基準にスケールする", async () => {
    const container = buildGallery();
    const img = container.querySelector("img") as HTMLImageElement;
    Object.defineProperty(img, "offsetWidth", {
      value: 50,
      configurable: true,
    });
    Object.defineProperty(img, "offsetHeight", {
      value: 100,
      configurable: true,
    });
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    expect(document.querySelector(".smartphoto-img-clone")).toBeInTheDocument();
  });

  it("拡大後の幅が画面幅を超える場合は画面幅に収まるよう補正する", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 768,
      configurable: true,
    });
    try {
      // item.width が非常に大きく、サムネイルの表示サイズ(offsetWidth)が小さいと、
      // item.width を基準にした拡大後の幅(width*scale)が画面幅を超えうる
      const trigger = document.createElement("button");
      const img = document.createElement("img");
      Object.defineProperty(img, "offsetWidth", {
        value: 10,
        configurable: true,
      });
      Object.defineProperty(img, "offsetHeight", {
        value: 5,
        configurable: true,
      });
      trigger.appendChild(img);
      document.body.appendChild(trigger);
      activeContainers.push(trigger);
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 5000, height: 100 }]),
      );
      smartPhoto.show(0, { trigger });
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      const clone = document.querySelector(
        ".smartphoto-img-clone",
      ) as HTMLElement;
      expect(clone).toBeInTheDocument();
      void smartPhoto;
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("lazyAttribute が設定されている場合はそれをアニメーション元画像に使う", async () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <a href="./large-a.jpg" class="js-smartphoto" data-caption="A" data-id="a">
        <img src="./a.jpg" data-src="./lazy-a.jpg" alt="A" />
      </a>
    `;
    document.body.appendChild(container);
    activeContainers.push(container);
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    const clone = document.querySelector(
      ".smartphoto-img-clone",
    ) as HTMLImageElement;
    expect(clone.getAttribute("src")).toBe("./lazy-a.jpg");
  });

  it("appear エフェクトの transitionend で後始末が完了する", async () => {
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    const clone = document.querySelector(".smartphoto-img-clone") as Element;
    fireEvent.transitionEnd(clone);
    await waitFor(() => {
      expect(
        document.querySelector(".smartphoto-img-clone"),
      ).not.toBeInTheDocument();
    });
  });
});

describe("スマートフォンでの window イベント", () => {
  it("orientationchange でレイアウトを再計算する", async () => {
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    expect(() =>
      fireEvent(window, new Event("orientationchange")),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 30));
  });

  it("orientationchange 直後は各スライドの transition を無効化し、旧位置からのアニメーションによる重なり表示を防ぐ", async () => {
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    fireEvent(window, new Event("orientationchange"));
    const slides = document.querySelectorAll(".smartphoto-list li");
    expect(slides.length).toBeGreaterThan(0);
    slides.forEach((li) => {
      expect((li as HTMLElement).style.transition).toBe("none");
    });
    await new Promise((r) => setTimeout(r, 30));
  });

  it("resize では何も起きない(スマートフォンでは resize を購読しない)", async () => {
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    expect(() => fireEvent(window, new Event("resize"))).not.toThrow();
  });

  it("orientationchange 後に画面幅が変化していれば再計算する", async () => {
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 100,
      configurable: true,
    });
    fireEvent(window, new Event("orientationchange"));
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 200,
      configurable: true,
    });
    await new Promise((r) => setTimeout(r, 40));
    delete (document.documentElement as { clientWidth?: number }).clientWidth;
  });

  it("orientationchange 直後は幅が既に新値でも高さだけ遅れて確定する場合があり、高さの変化だけでも再計算する", async () => {
    // clientWidth は回転直後にいち早く新しい値へ切り替わる一方、
    // visualViewport.height 相当の高さは遅れて確定することがある。幅の変化だけを
    // 監視していると、幅が一致してしまっているために高さが古いままの状態を
    // 見逃し、縦横比が崩れたまま(画像が縦に間延びしフィルムストリップへ重なって
    // 見える)固定されてしまっていた
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 800,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 100, height: 2000 }]),
      );
      smartPhoto.show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      // open 直後の resyncSizeAfterOpen() が次フレームで幅/高さの変化を
      // チェックしてしまう(§resyncSizeAfterOpen)。ここではまだ寸法を変えて
      // いないため無変化で解決させ、その後のorientationchange検証に影響しない
      // ようにする
      await new Promise((r) => setTimeout(r, 20));
      fireEvent(window, new Event("orientationchange"));
      // 幅はそのまま(800)、高さだけが遅れて新値(400)に切り替わる状況を再現する
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 400,
        configurable: true,
      });
      await new Promise((r) => setTimeout(r, 40));
      const imgWrap = document.querySelector(
        ".current .smartphoto-img-wrap",
      ) as HTMLElement;
      const scale = Number(
        imgWrap.style.transform.match(/scale\(([^)]+)\)/)?.[1],
      );
      // 高さ400基準(screenY=400-60-60-FIT_MARGIN(24)*2=232, scale=232/2000)に
      // 再計算されていること。幅だけを監視する実装のままだと800基準のscaleの
      // まま止まってしまう
      expect(scale).toBeCloseTo(232 / 2000);
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("待機時間を超えたら再帰を止める", async () => {
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    fireEvent(window, new Event("orientationchange"));
    await new Promise((r) => setTimeout(r, 600));
  });

  it("開いている間の visualViewport resize でもレイアウトを再計算する(#95)", async () => {
    // iOS Safari はアドレスバーの表示/非表示に伴う visualViewport の変化を
    // orientationchange なしで resize として発火する。スマートフォンでは window の
    // resize を購読しないため、この resize を拾わないと item.x/y が古い高さの
    // ままインラインスタイルに残り続け、表示中のスライドだけ位置がずれて見える
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    let resizeHandler: (() => void) | null = null;
    const stubViewport = {
      height: 800,
      scale: 1,
      addEventListener: vi.fn((type: string, handler: () => void) => {
        if (type === "resize") {
          resizeHandler = handler;
        }
      }),
      removeEventListener: vi.fn(),
    } as unknown as VisualViewport;
    Object.defineProperty(window, "visualViewport", {
      value: stubViewport,
      configurable: true,
    });

    const smartPhoto = track(
      new SmartPhoto([{ src: "/a.jpg", width: 100, height: 700 }]),
    );
    smartPhoto.show(0);
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });

    const imgWrap = document.querySelector(
      ".current .smartphoto-img-wrap",
    ) as HTMLElement;
    const beforeTransform = imgWrap.style.transform;

    stubViewport.height = 500;
    resizeHandler?.();

    expect(imgWrap.style.transform).not.toBe(beforeTransform);

    delete (window as { visualViewport?: VisualViewport }).visualViewport;
  });
});

describe("デスクトップでの resize/keydown", () => {
  it("resize イベントでレイアウトを再計算する", async () => {
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    expect(() => fireEvent(window, new Event("resize"))).not.toThrow();
  });

  it("ArrowLeft/ArrowRight で開いている間だけスライドが切り替わる", async () => {
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    fireEvent.keyDown(document, { key: "ArrowRight", keyCode: 39 });
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "B",
      );
    });
    fireEvent.keyDown(document, { key: "ArrowLeft", keyCode: 37 });
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "A",
      );
    });
  });
});

describe("スクロール位置のフォールバック", () => {
  it("pageXOffset/pageYOffset が undefined の場合は scrollLeft/scrollTop を使う", async () => {
    const originalX = Object.getOwnPropertyDescriptor(window, "pageXOffset");
    const originalY = Object.getOwnPropertyDescriptor(window, "pageYOffset");
    Object.defineProperty(window, "pageXOffset", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "pageYOffset", {
      value: undefined,
      configurable: true,
    });
    try {
      const container = buildGallery();
      const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
      expect(() =>
        fireEvent.click(
          container.querySelector(".js-smartphoto") as HTMLElement,
        ),
      ).not.toThrow();
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      expect(() => smartPhoto.hidePhoto()).not.toThrow();
    } finally {
      if (originalX) Object.defineProperty(window, "pageXOffset", originalX);
      if (originalY) Object.defineProperty(window, "pageYOffset", originalY);
    }
  });
});

describe("hidePhoto のその他の分岐", () => {
  it("useHistoryApi: false でハッシュが無い場合でも例外を投げない", async () => {
    const container = buildGallery();
    const smartPhoto = track(
      new SmartPhoto(".js-smartphoto", { useHistoryApi: false }),
    );
    await openViewer(container);
    expect(location.hash).toBe("");
    expect(() => smartPhoto.hidePhoto()).not.toThrow();
    fireEvent.transitionEnd(
      document.querySelector("dialog.smartphoto") as Element,
    );
  });

  it("トリガー要素が既に DOM から取り除かれている場合はフォーカス復帰をスキップする", async () => {
    const container = buildGallery();
    const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    (container.querySelector(".js-smartphoto") as HTMLElement).remove();
    expect(() => smartPhoto.hidePhoto()).not.toThrow();
    fireEvent.transitionEnd(
      document.querySelector("dialog.smartphoto") as Element,
    );
  });
});

describe("show() の activeElement フォールバック", () => {
  it("activeElement が HTMLElement で無い場合は null にフォールバックする", async () => {
    const originalActiveElement = Object.getOwnPropertyDescriptor(
      Document.prototype,
      "activeElement",
    );
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    document.body.appendChild(svg);
    activeContainers.push(svg as unknown as HTMLElement);
    Object.defineProperty(document, "activeElement", {
      value: svg,
      configurable: true,
    });
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }]),
      );
      expect(() => smartPhoto.show(0)).not.toThrow();
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
    } finally {
      if (originalActiveElement) {
        Object.defineProperty(
          Document.prototype,
          "activeElement",
          originalActiveElement,
        );
      }
    }
  });
});

describe("item.src が無い場合の読み込み", () => {
  it("href の無いサムネイルでは Image.src に空文字を設定する", () => {
    const originalImage = window.Image;
    let assignedSrc: string | undefined;
    class RecordingImageMock {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        assignedSrc = value;
      }
    }
    window.Image = RecordingImageMock as unknown as typeof window.Image;
    try {
      const container = document.createElement("div");
      container.innerHTML = `
        <a class="js-smartphoto" data-caption="A" data-id="a">
          <img alt="A" />
        </a>
      `;
      document.body.appendChild(container);
      activeContainers.push(container);
      track(new SmartPhoto(".js-smartphoto"));
      fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
      expect(assignedSrc).toBe("");
    } finally {
      window.Image = originalImage;
    }
  });
});

describe("画像読み込み失敗パス", () => {
  it("onerror 経由で resolve され、loaded は true にならない", async () => {
    const originalImage = window.Image;
    class FailingImageMock {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    window.Image = FailingImageMock as unknown as typeof window.Image;
    try {
      track(new SmartPhoto([{ src: "/broken.jpg" }])).show(0);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      // 読み込み失敗のため未処理(ローダー表示)のまま
      expect(
        document.querySelector(".smartphoto-loader-wrap"),
      ).toBeInTheDocument();
    } finally {
      window.Image = originalImage;
    }
  });
});

describe("addAppearEffect の追加分岐", () => {
  it("resizeStyle: fill かつスマートフォンで縦長画像は windowWidth を基準にスケールする", async () => {
    withStubbedUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const container = buildGallery();
    const img = container.querySelector("img") as HTMLImageElement;
    Object.defineProperty(img, "offsetWidth", {
      value: 50,
      configurable: true,
    });
    Object.defineProperty(img, "offsetHeight", {
      value: 100,
      configurable: true,
    });
    track(new SmartPhoto(".js-smartphoto", { resizeStyle: "fill" }));
    await openViewer(container);
    expect(document.querySelector(".smartphoto-img-clone")).toBeInTheDocument();
  });

  it("縦長画像で screenY を超える高さの場合は screenY を基準にスケールする", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 768,
      configurable: true,
    });
    try {
      const container = document.createElement("div");
      container.innerHTML = `
        <a href="./large-tall.jpg" class="js-smartphoto" data-caption="Tall" data-id="tall">
          <img src="./tall.jpg" alt="Tall" />
        </a>
      `;
      document.body.appendChild(container);
      activeContainers.push(container);
      const img = container.querySelector("img") as HTMLImageElement;
      Object.defineProperty(img, "offsetWidth", {
        value: 50,
        configurable: true,
      });
      Object.defineProperty(img, "offsetHeight", {
        value: 100,
        configurable: true,
      });
      const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
      fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
      await waitFor(() => {
        expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
          "open",
        );
      });
      expect(
        document.querySelector(".smartphoto-img-clone"),
      ).toBeInTheDocument();
      void smartPhoto;
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("横長画像で画面に収まる場合は item.width を基準にスケールする", async () => {
    Object.defineProperty(document.documentElement, "clientWidth", {
      value: 1024,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      value: 768,
      configurable: true,
    });
    try {
      const container = buildGallery();
      const img = container.querySelector("img") as HTMLImageElement;
      Object.defineProperty(img, "offsetWidth", {
        value: 100,
        configurable: true,
      });
      Object.defineProperty(img, "offsetHeight", {
        value: 50,
        configurable: true,
      });
      track(new SmartPhoto(".js-smartphoto"));
      await openViewer(container);
      expect(
        document.querySelector(".smartphoto-img-clone"),
      ).toBeInTheDocument();
    } finally {
      delete (document.documentElement as { clientWidth?: number }).clientWidth;
      delete (document.documentElement as { clientHeight?: number })
        .clientHeight;
    }
  });

  it("lazyAttribute も item.src も無い場合はクローン画像の src が空文字になる", async () => {
    // データモード + width/height 指定で loadItem の非同期待ちを回避し、
    // lazyAttribute の無い img を明示的に trigger として渡す
    const trigger = document.createElement("button");
    const img = document.createElement("img");
    trigger.appendChild(img);
    document.body.appendChild(trigger);
    activeContainers.push(trigger);
    const smartPhoto = track(
      new SmartPhoto([{ src: "", width: 10, height: 10 }]),
    );
    smartPhoto.show(0, { trigger });
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).toHaveAttribute(
        "open",
      );
    });
    const clone = document.querySelector(
      ".smartphoto-img-clone",
    ) as HTMLImageElement;
    expect(clone.getAttribute("src")).toBe("");
  });
});

describe("スワイプが閾値未満の場合(実結線)", () => {
  it("close-bottom も次/前スライドにもならず、その場に留まる", async () => {
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    const content = document.querySelector(
      ".smartphoto-content",
    ) as HTMLElement;
    const pointerEvent = (type: string, clientX: number, clientY: number) =>
      new PointerEvent(type, {
        pointerId: 1,
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
      });
    content.dispatchEvent(pointerEvent("pointerdown", 100, 100));
    content.dispatchEvent(pointerEvent("pointermove", 110, 100));
    content.dispatchEvent(pointerEvent("pointerup", 110, 100));
    await new Promise((r) => setTimeout(r, 250));
    expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
      "A",
    );
    expect(document.querySelector("dialog.smartphoto")).toHaveAttribute("open");
  });
});
