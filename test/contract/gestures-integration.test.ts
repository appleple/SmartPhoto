import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SmartPhoto from "../../src/index";

// gestures.ts の単体テスト(test/unit/gestures.test.ts)は入力レイヤーだけを検証する。
// ここでは実際の SmartPhoto に Pointer Events を通し、gestures → facade の結線
// (buildGestureCallbacks: swipe/pinch/photo-drag の結果に応じたナビゲーション・
// イベント発火)がエンドツーエンドで機能することを検証する
let activeInstances: SmartPhoto[] = [];
let activeContainers: HTMLElement[] = [];

beforeEach(() => {
  // jsdom は documentElement.clientWidth/Height が既定で 0 のため、
  // ズーム倍率などの計算が意味を持つよう現実的なビューポートに差し替える
  Object.defineProperty(document.documentElement, "clientWidth", {
    value: 1024,
    configurable: true,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    value: 768,
    configurable: true,
  });
});

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
  delete (document.documentElement as { clientWidth?: number }).clientWidth;
  delete (document.documentElement as { clientHeight?: number }).clientHeight;
  vi.restoreAllMocks();
});

const track = <T extends SmartPhoto>(instance: T): T => {
  activeInstances.push(instance);
  return instance;
};

const pointerEvent = (
  type: string,
  { pointerId = 1, clientX = 0, clientY = 0 } = {},
) =>
  new PointerEvent(type, {
    pointerId,
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
  });

const buildAndOpen = async (slides: unknown[], settings = {}) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  activeContainers.push(container);
  const smartPhoto = track(new SmartPhoto(slides as never, settings));
  smartPhoto.show(0);
  await waitFor(() => {
    expect(document.querySelector("dialog.smartphoto")).toHaveAttribute("open");
  });
  const content = document.querySelector(".smartphoto-content") as HTMLElement;
  return { smartPhoto, content };
};

// スワイプ/ナビゲーションだけを見るテストでは画面に収まる小さな画像で十分
const slides3 = [
  { src: "/a.jpg", caption: "A", width: 200, height: 200 },
  { src: "/b.jpg", caption: "B", width: 200, height: 200 },
  { src: "/c.jpg", caption: "C", width: 200, height: 200 },
];

// ズームを伴うテストは 1024x768 のビューポートより大きい画像で scaleBorder > 1 にする
const zoomSlides = [
  { src: "/a.jpg", caption: "A", width: 2000, height: 2000 },
  { src: "/b.jpg", caption: "B", width: 2000, height: 2000 },
];

describe("スワイプ(実結線)", () => {
  it("横スワイプで次のスライドへ進み swipestart/swipeend が発火する", async () => {
    const { content } = await buildAndOpen(slides3);
    const swipestart = vi.fn();
    const swipeend = vi.fn();
    activeInstances[0].on("swipestart", swipestart);
    activeInstances[0].on("swipeend", swipeend);

    content.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 300, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointermove", { clientX: 150, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { clientX: 150, clientY: 100 }),
    );

    expect(swipestart).toHaveBeenCalledTimes(1);
    expect(swipeend).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "B",
      );
    });
  });

  it("下スワイプで閾値を超えると close-bottom として閉じる", async () => {
    const { content } = await buildAndOpen(slides3, {
      swipeBottomToClose: true,
    });
    content.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointermove", { clientX: 100, clientY: 250 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { clientX: 100, clientY: 250 }),
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
  });

  it("上スワイプで閾値を超えると close-top として閉じる", async () => {
    const { content } = await buildAndOpen(slides3, { swipeTopToClose: true });
    content.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 100, clientY: 250 }),
    );
    content.dispatchEvent(
      pointerEvent("pointermove", { clientX: 100, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
  });

  it("右方向へのスワイプで前のスライドへ戻る", async () => {
    const { smartPhoto, content } = await buildAndOpen(slides3);
    smartPhoto.gotoSlide(1);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "B",
      );
    });
    content.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointermove", { clientX: 250, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { clientX: 250, clientY: 100 }),
    );
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "A",
      );
    });
  });

  it("写真の上のタップ(移動0)で onTap 経由の zoomPhoto が呼ばれる", async () => {
    await buildAndOpen(zoomSlides);
    const zoomin = vi.fn();
    activeInstances[0].on("zoomin", zoomin);
    const img = document.querySelector(".current .smartphoto-img") as Element;
    img.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 50, clientY: 50 }),
    );
    img.dispatchEvent(pointerEvent("pointerup", { clientX: 50, clientY: 50 }));
    await waitFor(() => expect(zoomin).toHaveBeenCalledTimes(1));
  });

  it("写真の外(背景)のタップではズームせず、ビューアが閉じる", async () => {
    // 主要ライトボックス(PhotoSwipe: bgClickAction 'close'、Fancybox:
    // backdropClick 'close'、GLightbox: closeOnOutsideClick、lightGallery:
    // closable)のデファクトスタンダードに合わせ、写真の外側のタップは
    // 「閉じる」。以前はタップ位置を区別せず常に zoomPhoto() が呼ばれ、
    // 「閉じようとして背景をクリックしたらズームが始まる」動線になっていた
    const { content } = await buildAndOpen(zoomSlides);
    const zoomin = vi.fn();
    activeInstances[0].on("zoomin", zoomin);
    content.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 50, clientY: 50 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { clientX: 50, clientY: 50 }),
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
    expect(zoomin).not.toHaveBeenCalled();
    fireEvent.transitionEnd(
      document.querySelector("dialog.smartphoto") as Element,
    );
  });

  it("ズームできない(画面に収まる)写真の上のタップではビューアが閉じる(zoom-or-close)", async () => {
    // PhotoSwipe の imageClickAction: 'zoom-or-close'(デフォルト)に合わせ、
    // scaleBorder <= 1 でズームの余地がない写真へのタップは「閉じる」。
    // 以前は zoomPhoto() が早期 return するだけで、タップしても何も
    // 起きない(反応しない UI になる)だけだった
    await buildAndOpen(slides3);
    const img = document.querySelector(".current .smartphoto-img") as Element;
    img.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 512, clientY: 384 }),
    );
    img.dispatchEvent(
      pointerEvent("pointerup", { clientX: 512, clientY: 384 }),
    );
    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
    fireEvent.transitionEnd(
      document.querySelector("dialog.smartphoto") as Element,
    );
  });
});

describe("ピンチ(実結線)", () => {
  it("2本指ピンチで gesturestart が発火し、拡大したまま離すとズーム状態を維持する", async () => {
    const { content } = await buildAndOpen(zoomSlides);
    const gesturestart = vi.fn();
    activeInstances[0].on("gesturestart", gesturestart);

    content.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 2, clientX: 120, clientY: 100 }),
    );
    expect(gesturestart).toHaveBeenCalledTimes(1);

    content.dispatchEvent(
      pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { pointerId: 2, clientX: 120, clientY: 100 }),
    );
  });

  it("少し縮小して離すと gestureend が発火しフィットへ戻る", async () => {
    const { content } = await buildAndOpen(zoomSlides);
    const gestureend = vi.fn();
    activeInstances[0].on("gestureend", gestureend);

    content.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 2, clientX: 500, clientY: 100 }),
    );
    // 距離 400 → 380 で scaleSize 0.8(閉じる閾値 0.75 は下回らない)
    content.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 2, clientX: 480, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
    );

    expect(gestureend).toHaveBeenCalledTimes(1);
    expect(document.querySelector("dialog.smartphoto")).toHaveAttribute("open");
  });

  it("大きく縮めて離すとビューアが閉じる(pinchToClose)", async () => {
    const { content } = await buildAndOpen(zoomSlides);

    content.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerdown", { pointerId: 2, clientX: 500, clientY: 100 }),
    );
    // 距離を大きく縮めて scaleSize を閉じる閾値(基準の3/4)未満まで下げる
    content.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 2, clientX: 105, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
    );

    await waitFor(() => {
      expect(document.querySelector("dialog.smartphoto")).not.toHaveAttribute(
        "open",
      );
    });
  });
});

describe("ズーム中の画像ドラッグ(実結線)", () => {
  const openZoomed = async () => {
    const { smartPhoto, content } = await buildAndOpen(zoomSlides);
    smartPhoto.zoomPhoto();
    // scale 状態への移行はズームアニメーション完了(animationSpeed=450ms)後
    await new Promise((r) => setTimeout(r, 500));
    return { smartPhoto, content };
  };

  it("移動の無いリリースで zoomOutPhoto が呼ばれる(zoomout イベント)", async () => {
    const { smartPhoto, content } = await openZoomed();
    const zoomout = vi.fn();
    smartPhoto.on("zoomout", zoomout);
    content.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
    );
    expect(zoomout).toHaveBeenCalledTimes(1);
  });

  it("境界を大きく超えるドラッグで次のスライドへ進む", async () => {
    const { content } = await openZoomed();
    content.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 5000, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointermove", { clientX: 0, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { clientX: 0, clientY: 100 }),
    );
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "B",
      );
    });
  });

  it("反対方向へ境界を大きく超えるドラッグで前のスライドへ戻る", async () => {
    const { smartPhoto, content } = await openZoomed();
    smartPhoto.gotoSlide(1);
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "B",
      );
    });
    smartPhoto.zoomPhoto();
    // scale 状態への移行はズームアニメーション完了(animationSpeed=450ms)後
    await new Promise((r) => setTimeout(r, 500));
    content.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 0, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointermove", { clientX: 5000, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointerup", { clientX: 5000, clientY: 100 }),
    );
    await waitFor(() => {
      expect(document.querySelector(".smartphoto-caption")?.textContent).toBe(
        "A",
      );
    });
  });

  it("境界内の小さなドラッグではその場に留まる(updatePhotoTransform のみ)", async () => {
    const { content } = await openZoomed();
    content.dispatchEvent(
      pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
    );
    content.dispatchEvent(
      pointerEvent("pointermove", { clientX: 105, clientY: 100 }),
    );
    expect(() =>
      content.dispatchEvent(
        pointerEvent("pointerup", { clientX: 105, clientY: 100 }),
      ),
    ).not.toThrow();
  });
});
