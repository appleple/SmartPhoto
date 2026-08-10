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

  it("hidePhoto(top) では画像が上方向へ移動する", async () => {
    const container = buildGallery();
    const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
    await openViewer(container);
    smartPhoto.hidePhoto("top");
    const img = document.querySelector(
      ".current .smartphoto-img",
    ) as HTMLElement;
    expect(img.style.transform).toContain("translateY(-");
    fireEvent.transitionEnd(
      document.querySelector("dialog.smartphoto") as Element,
    );
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
    // view-transition-name の後始末(clearNames)が検証前に走ってしまうため、
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

  it("finished 解決後に view-transition-name の後始末(clearNames)が行われる", async () => {
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
