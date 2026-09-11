import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import SmartPhoto from "../../src/index";

// まれな実行順・不正な入力・レースに対する防御的分岐を固定するテスト群。
// 「起きないはず」の状態でも壊れず安全側に倒れることを保証する

let activeInstances: SmartPhoto[] = [];
let activeContainers: HTMLElement[] = [];

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

const buildGallery = (html?: string) => {
  const container = document.createElement("div");
  container.innerHTML =
    html ??
    `
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

const openDialog = () => document.querySelector("dialog.smartphoto");

const waitForOpen = () =>
  waitFor(() => {
    expect(openDialog()).toHaveAttribute("open");
  });

const withStubbedViewport = (width: number, height: number) => {
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: height,
    configurable: true,
  });
  return () => {
    delete (document.documentElement as { clientWidth?: number }).clientWidth;
    delete (document.documentElement as { clientHeight?: number }).clientHeight;
  };
};

const heldViewTransition = () => {
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
  const cleanup = () => {
    delete (document as unknown as { startViewTransition?: unknown })
      .startViewTransition;
  };
  return { held, startViewTransition, cleanup };
};

describe("document クリックのデリゲーション境界", () => {
  it("Element 以外がターゲットのクリックは無視する", () => {
    buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    // document 自体をターゲットにしたクリック(テキストノード上のクリック等の相当)
    expect(() =>
      document.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    ).not.toThrow();
    expect(openDialog()).not.toHaveAttribute("open");
  });

  it("未登録要素のクリックで resync が変化なしを返した場合は開かない", async () => {
    const container = buildGallery();
    const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
    // 「DOM とグループの再同期を行っても件数・構成が変わらない」レースを
    // 強制するため、resync を変化なし(false)に固定する
    vi.spyOn(
      smartPhoto as unknown as { resyncGroupFromDom(groupId: string): boolean },
      "resyncGroupFromDom",
    ).mockReturnValue(false);
    const added = document.createElement("a");
    added.href = "./large-c.jpg";
    added.className = "js-smartphoto";
    added.innerHTML = '<img src="./c.jpg" alt="C" />';
    container.appendChild(added);
    fireEvent.click(added);
    await new Promise((r) => setTimeout(r, 20));
    expect(openDialog()).not.toHaveAttribute("open");
  });

  it("新しいグループの要素が後から追加されてもクリックで開ける", async () => {
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto"));
    // 構築時に存在しなかったグループ(state.groups に無い)を後から追加する
    const added = document.createElement("a");
    added.href = "./large-x.jpg";
    added.className = "js-smartphoto";
    added.setAttribute("data-group", "late-group");
    added.setAttribute("data-caption", "X");
    added.innerHTML = '<img src="./x.jpg" alt="X" />';
    container.appendChild(added);
    fireEvent.click(added);
    await waitForOpen();
    expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
      "X",
    );
  });

  it("セレクタ構築のグループへ element を持たない slide を追加しても resync で壊れない", async () => {
    const container = buildGallery();
    const smartPhoto = track(new SmartPhoto(".js-smartphoto"));
    // アンカー(nogroup)と同じグループへ、element を持たない slide を追加する。
    // resync は DOM を正として再構築するため slide 側は破棄されるが、例外や
    // 開けない状態にはならないこと
    smartPhoto.addItem({ src: "/slide.jpg", width: 10, height: 10 });
    fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
    await waitForOpen();
    expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
      "A",
    );
  });
});

describe("gotoSlide の入力境界", () => {
  it("数値に解釈できない index は先頭(0)として扱う", async () => {
    const smartPhoto = track(
      new SmartPhoto([
        { src: "/a.jpg", width: 10, height: 10, caption: "A" },
        { src: "/b.jpg", width: 10, height: 10, caption: "B" },
      ]),
    );
    smartPhoto.show(1);
    await waitForOpen();
    expect(smartPhoto.currentIndex).toBe(1);
    smartPhoto.gotoSlide("abc" as unknown as number);
    expect(smartPhoto.currentIndex).toBe(0);
    await new Promise((r) => setTimeout(r, 250));
  });
});

describe("View Transition の実行時境界", () => {
  it("startViewTransition が undefined を返しても後続処理が壊れない", async () => {
    // 壊れたポリフィル等で ViewTransition オブジェクトが得られないケース。
    // DOM 更新のコールバックは実行される前提で、戻り値だけが undefined になる
    const startViewTransition = vi.fn((callback: () => void) => {
      callback();
      return undefined;
    });
    (
      document as unknown as { startViewTransition: typeof startViewTransition }
    ).startViewTransition = startViewTransition;
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }]),
      );
      smartPhoto.show(0);
      await waitForOpen();
      expect(startViewTransition).toHaveBeenCalledTimes(1);
      // トランジションが得られなくても次の操作(閉じる)が正常に行えること
      smartPhoto.hidePhoto();
      await waitFor(() => {
        expect(openDialog()).not.toHaveAttribute("open");
      });
    } finally {
      delete (document as unknown as { startViewTransition?: unknown })
        .startViewTransition;
    }
  });

  it("トランジション完了前に閉じられた場合、後始末はレイアウトを触らない", async () => {
    const { held, cleanup } = heldViewTransition();
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }]),
      );
      smartPhoto.show(0);
      await waitForOpen();
      smartPhoto.hidePhoto();
      // 閉じた後に finished が解決しても、閉じ演出の transform を上書きしない
      held.resolve();
      await new Promise((r) => setTimeout(r, 20));
      expect(openDialog()).not.toHaveAttribute("open");
    } finally {
      cleanup();
    }
  });

  it("トランジション中に2枚目のスライドを表示しても非カレント側で復元が乱れない", async () => {
    const restore = withStubbedViewport(1000, 800);
    const { held, cleanup } = heldViewTransition();
    try {
      const smartPhoto = track(
        new SmartPhoto([
          { src: "/a.jpg", width: 2000, height: 1140, caption: "A" },
          { src: "/b.jpg", width: 2000, height: 1140, caption: "B" },
        ]),
      );
      // 2枚目を直接開く: モーフ用レイアウトの適用ループが非カレント(1枚目)を
      // スキップする経路を通る
      smartPhoto.show(1);
      await waitForOpen();
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      expect(img.style.width).toBe("1000px");
      held.resolve();
      await waitFor(() => {
        expect(img.style.width).toBe("2000px");
      });
    } finally {
      cleanup();
      restore();
    }
  });

  it("画面より小さい画像(scale >= 1)はモーフ用レイアウトへ差し替えない", async () => {
    const restore = withStubbedViewport(1000, 800);
    const { held, cleanup } = heldViewTransition();
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 100, height: 100 }]),
      );
      smartPhoto.show(0);
      await waitForOpen();
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      // fit は縮小専用(scale=1 のまま)なので、レイアウト差し替えは不要
      expect(img.style.width).toBe("100px");
      held.resolve();
      await new Promise((r) => setTimeout(r, 20));
      expect(img.style.width).toBe("100px");
    } finally {
      cleanup();
      restore();
    }
  });

  it("開いた直後にビューポート幅が変わっても、再計算はトランジション完了まで保留される", async () => {
    const restore = withStubbedViewport(1000, 800);
    const { held, cleanup } = heldViewTransition();
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 1140 }]),
      );
      smartPhoto.show(0);
      await waitForOpen();
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      expect(img.style.width).toBe("1000px");
      // 開いた直後(次フレームの再同期前)にスクロールバー消失等で幅が変わる状況
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 800,
        configurable: true,
      });
      // resyncSizeAfterOpen の requestAnimationFrame を確実に経過させる
      await new Promise((r) => setTimeout(r, 50));
      // トランジション中は保留され、モーフ用レイアウトは維持される
      expect(img.style.width).toBe("1000px");
      held.resolve();
      await waitFor(() => {
        expect(img.style.width).toBe("2000px");
      });
      const imgWrap = document.querySelector(
        ".current .smartphoto-img-wrap",
      ) as HTMLElement;
      expect(imgWrap.style.transform).toContain(`scale(${800 / 2000})`);
    } finally {
      cleanup();
      restore();
    }
  });
});

describe("visualViewport / orientationchange の再計算境界", () => {
  const withVisualViewport = (height: number) => {
    const listeners: Array<() => void> = [];
    Object.defineProperty(window, "visualViewport", {
      value: {
        height,
        width: 1000,
        scale: 1,
        addEventListener: (_: string, fn: () => void) => {
          listeners.push(fn);
        },
        removeEventListener: () => {},
      },
      configurable: true,
      writable: true,
    });
    return {
      fireResize: () => {
        listeners.forEach((fn) => {
          fn();
        });
      },
      cleanup: () => {
        delete (window as { visualViewport?: unknown }).visualViewport;
      },
    };
  };

  it("閉じている間の visualViewport リサイズは高さ変数の更新だけを行う", () => {
    const vv = withVisualViewport(700);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    try {
      track(new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }]));
      expect(() => {
        vv.fireResize();
      }).not.toThrow();
      const dialog = openDialog() as HTMLElement;
      expect(dialog.style.getPropertyValue("--smartphoto-vh")).toBe("700px");
    } finally {
      vv.cleanup();
    }
  });

  it("トランジション中の visualViewport リサイズは完了まで保留される", async () => {
    const restore = withStubbedViewport(1000, 800);
    const vv = withVisualViewport(800);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const { held, cleanup } = heldViewTransition();
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 1140 }]),
      );
      smartPhoto.show(0);
      await waitForOpen();
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      expect(img.style.width).toBe("1000px");
      vv.fireResize();
      // 保留: モーフ用レイアウトが巻き戻されない
      expect(img.style.width).toBe("1000px");
      held.resolve();
      await waitFor(() => {
        expect(img.style.width).toBe("2000px");
      });
    } finally {
      cleanup();
      vv.cleanup();
      restore();
    }
  });

  it("トランジション中の orientationchange は完了まで保留される", async () => {
    const restore = withStubbedViewport(1000, 800);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const { held, cleanup } = heldViewTransition();
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 2000, height: 1140 }]),
      );
      smartPhoto.show(0);
      await waitForOpen();
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      expect(img.style.width).toBe("1000px");
      window.dispatchEvent(new Event("orientationchange"));
      expect(img.style.width).toBe("1000px");
      held.resolve();
      await waitFor(() => {
        expect(img.style.width).toBe("2000px");
      });
    } finally {
      cleanup();
      restore();
    }
  });

  it("orientationchange 後の再計測ポーリング中に閉じても安全に停止する", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const smartPhoto = track(
      new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }], {
        showAnimation: false,
      }),
    );
    smartPhoto.show(0);
    await waitForOpen();
    window.dispatchEvent(new Event("orientationchange"));
    smartPhoto.hidePhoto();
    // ポーリング(25ms 間隔)が isOpen=false を検知して安全に打ち切ること
    await new Promise((r) => setTimeout(r, 60));
    expect(openDialog()).not.toHaveAttribute("open");
  });
});

describe("空グループ・状態不整合への防御", () => {
  type InternalAccess = {
    setPosByCurrentIndex(): void;
    setSizeByScreen(): void;
    loadNeighborItems(): void;
    syncFillScale(): void;
    currentLiElement(): HTMLLIElement | null;
    state: { viewer: { currentIndex: number } };
  };

  it("アイテムが無い状態の内部再計算はすべて no-op になる", () => {
    // resize/orientationchange ハンドラや読み込み完了コールバックは、レース次第で
    // グループが空になった後に到達し得る。currentItems が null でも安全に
    // 早期リターンすることを固定する
    const smartPhoto = track(new SmartPhoto([]));
    const internal = smartPhoto as unknown as InternalAccess;
    expect(() => {
      internal.setPosByCurrentIndex();
      internal.setSizeByScreen();
      internal.loadNeighborItems();
    }).not.toThrow();
  });

  it("resizeStyle: 'fill' でもアイテムが無ければ fill 倍率の同期は no-op になる", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    const smartPhoto = track(new SmartPhoto([], { resizeStyle: "fill" }));
    const internal = smartPhoto as unknown as InternalAccess;
    expect(() => {
      internal.syncFillScale();
    }).not.toThrow();
  });

  it("currentIndex に対応するスライドが無い場合 currentLiElement は null を返す", () => {
    const smartPhoto = track(
      new SmartPhoto([{ src: "/a.jpg", width: 10, height: 10 }]),
    );
    const internal = smartPhoto as unknown as InternalAccess;
    internal.state.viewer.currentIndex = 99;
    expect(internal.currentLiElement()).toBeNull();
  });
});

describe("resizeStyle: 'fill' のズーム解除", () => {
  it("zoomOutPhoto() は fit(1倍)ではなく fill 表示(基準倍率)へ戻す", async () => {
    // fill(スマホ)は「fill 表示」が開いた時点の基準状態。タップによる
    // ズーム解除で fit(上下黒帯 + UI 再表示)まで戻ってしまうと、ピンチの
    // 戻り先(基準 = fill)と食い違う。PhotoSwipe の initialZoomLevel の
    // 作法に合わせ、解除の戻り先も fill に統一する
    const restore = withStubbedViewport(1000, 800);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    );
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 1716, height: 1140 }], {
          resizeStyle: "fill",
        }),
      );
      smartPhoto.show(0);
      await waitForOpen();
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      const fillScale = () =>
        Number.parseFloat(
          /scale\(([^)]+)\)/.exec(img.style.transform)?.[1] ?? "0",
        );
      const opened = fillScale();
      expect(opened).toBeGreaterThan(1);

      smartPhoto.zoomOutPhoto();
      // fill の基準倍率のまま(1 へは戻らない)
      expect(fillScale()).toBeCloseTo(opened, 5);
      // fill は開いた時点から UI 非表示のズーム状態なので、それも維持される
      expect(
        document.querySelector(".smartphoto-nav")?.getAttribute("aria-hidden"),
      ).toBe("true");
    } finally {
      restore();
    }
  });

  it("fit(デフォルト)では従来どおり 1 倍へ戻し UI を再表示する", async () => {
    const restore = withStubbedViewport(1000, 800);
    try {
      const smartPhoto = track(
        new SmartPhoto([{ src: "/a.jpg", width: 1716, height: 1140 }]),
      );
      smartPhoto.show(0);
      await waitForOpen();
      smartPhoto.zoomPhoto();
      smartPhoto.zoomOutPhoto();
      const img = document.querySelector(
        ".current .smartphoto-img",
      ) as HTMLElement;
      expect(img.style.transform).toContain("scale(1)");
      expect(
        document.querySelector(".smartphoto-nav")?.getAttribute("aria-hidden"),
      ).toBe("false");
    } finally {
      restore();
    }
  });
});

describe("閉じ演出の transform 凍結", () => {
  it("描画中の transform が 'none' の場合は凍結しない", async () => {
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto", { animationSpeed: 50 }));
    fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
    await waitForOpen();
    const img = document.querySelector(
      ".current .smartphoto-img",
    ) as HTMLElement;
    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
      const style = original(el as Element, pseudo as string | undefined);
      if (el === img) {
        Object.defineProperty(style, "transform", {
          value: "none",
          configurable: true,
        });
      }
      return style;
    });
    const before = img.style.transform;
    fireEvent.click(
      document.querySelector(".smartphoto-dismiss") as HTMLElement,
    );
    // 'none' はインラインへ書き戻す意味がない(打ち切るべき transition が無い)
    expect(img.style.transform).toBe(before);
    vi.restoreAllMocks();
    await new Promise((r) => setTimeout(r, 200));
  });

  it("進行中のズーム transition は描画中の値で打ち切られ、後始末で除去される", async () => {
    const container = buildGallery();
    track(new SmartPhoto(".js-smartphoto", { animationSpeed: 50 }));
    fireEvent.click(container.querySelector(".js-smartphoto") as HTMLElement);
    await waitForOpen();
    const img = document.querySelector(
      ".current .smartphoto-img",
    ) as HTMLElement;
    // 実ブラウザで transition の補間途中に閉じた状況(getComputedStyle が
    // 中間値の matrix を返す)を再現する
    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
      const style = original(el as Element, pseudo as string | undefined);
      if (el === img) {
        Object.defineProperty(style, "transform", {
          value: "matrix(1.5, 0, 0, 1.5, 10, 10)",
          configurable: true,
        });
      }
      return style;
    });
    fireEvent.click(
      document.querySelector(".smartphoto-dismiss") as HTMLElement,
    );
    // 閉じ演出中: 描画中の値がインラインへ凍結される
    expect(img.style.transform).toBe("matrix(1.5, 0, 0, 1.5, 10, 10)");
    vi.restoreAllMocks();
    // フォールバックタイマー(animationSpeed + 100ms)後に凍結値が除去される
    await waitFor(() => {
      expect(img.style.transform).toBe("");
    });
  });
});
