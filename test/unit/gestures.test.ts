import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGestures } from "../../src/core/gestures";
import {
  addItemToGroup,
  createState,
  itemFromSlide,
} from "../../src/core/state";

const orientationEvent = (props: { gamma?: number; beta?: number } = {}) =>
  Object.assign(new Event("deviceorientation"), props);

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

const buildHarness = (settings = {}, { smartPhone = false } = {}) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    smartPhone
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
      : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
  );
  const state = createState(settings);
  addItemToGroup(state, itemFromSlide({ src: "a.jpg", group: "g1" }, 0, 500));
  addItemToGroup(state, itemFromSlide({ src: "b.jpg", group: "g1" }, 1, 500));
  addItemToGroup(state, itemFromSlide({ src: "c.jpg", group: "g1" }, 2, 500));
  state.viewer.currentGroup = "g1";
  state.viewer.currentIndex = 1;
  state.viewer.total = 3;
  state.groups.get("g1")?.forEach((item) => {
    item.width = 200;
    item.height = 200;
    item.scale = 1;
  });

  const callbacks = {
    onSwipeStart: vi.fn(),
    onSwipeMove: vi.fn(),
    onSwipeEnd: vi.fn(),
    onTap: vi.fn(),
    onGestureStart: vi.fn(),
    onGestureMove: vi.fn(),
    onGestureEnd: vi.fn(),
    onPinchClose: vi.fn(),
    onPhotoDragMove: vi.fn(),
    onPhotoDragEnd: vi.fn(),
  };

  const controller = new AbortController();
  const gestures = createGestures(
    { state, callbacks },
    { signal: controller.signal },
  );
  const content = document.createElement("div");
  const imgWrap = document.createElement("div");
  content.appendChild(imgWrap);
  document.body.appendChild(content);
  gestures.attach(content);

  return { state, callbacks, gestures, content, imgWrap, controller };
};

describe("gestures", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  describe("スワイプ(横方向)", () => {
    it("しきい値を超えると next になる", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 300, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 150, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 150, clientY: 100 }),
      );
      expect(callbacks.onSwipeStart).toHaveBeenCalledTimes(1);
      expect(callbacks.onSwipeMove).toHaveBeenCalled();
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("next");
      expect(state.viewer.translateX).not.toBe(0);
    });

    it("しきい値を超えると prev になる", () => {
      const { imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 250, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 250, clientY: 100 }),
      );
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("prev");
    });

    it("先頭では prev にならず stay になる", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      state.viewer.currentIndex = 0;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 250, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 250, clientY: 100 }),
      );
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("stay");
    });

    it("末尾では next にならず stay になる", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      state.viewer.currentIndex = 2;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 300, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 150, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 150, clientY: 100 }),
      );
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("stay");
    });

    it("しきい値未満の movement でもゆっくりなら stay になる", () => {
      const { imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 110, clientY: 100 }),
      );
      // 実際のゆっくりしたドラッグを模してフリック判定に入らないようにする
      vi.advanceTimersByTime(200);
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 110, clientY: 100 }),
      );
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("stay");
    });

    it("しきい値未満でも素早いフリックなら next になる", () => {
      const { imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 300, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 260, clientY: 100 }),
      );
      // 40px の移動を 40ms で行う速いフリック(0.5px/ms 以上)を模す
      vi.advanceTimersByTime(40);
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 260, clientY: 100 }),
      );
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("next");
    });

    it("しきい値未満で移動距離が最小フリック距離未満なら stay になる", () => {
      const { imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 300, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 295, clientY: 100 }),
      );
      vi.advanceTimersByTime(1);
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 295, clientY: 100 }),
      );
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("stay");
    });

    it("swipeVelocity を大きくすると同じ速さのフリックでも stay になる", () => {
      // デフォルト(0.5)なら next になる 40px/40ms(1.0px/ms) のフリックが、
      // swipeVelocity をそれより大きくすると isFlick 判定に入らなくなることを確認する
      const { imgWrap, callbacks } = buildHarness({ swipeVelocity: 10 });
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 300, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 260, clientY: 100 }),
      );
      vi.advanceTimersByTime(40);
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 260, clientY: 100 }),
      );
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("stay");
    });
  });

  describe("スワイプ(縦方向)", () => {
    it("下スワイプで swipeBottomToClose なら close-bottom になる", () => {
      const { imgWrap, callbacks } = buildHarness({ swipeBottomToClose: true });
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 100, clientY: 250 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 250 }),
      );
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("close-bottom");
    });

    it("上スワイプで swipeTopToClose なら close-top になる", () => {
      const { imgWrap, callbacks } = buildHarness({ swipeTopToClose: true });
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 250 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("close-top");
    });

    it("close オプションが無効なら stay になる", () => {
      const { imgWrap, callbacks } = buildHarness({
        swipeBottomToClose: false,
        swipeTopToClose: false,
      });
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 100, clientY: 250 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 250 }),
      );
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("stay");
    });
  });

  describe("タップ判定", () => {
    it("デスクトップでは移動0のリリースで、pointerdown のヒット要素を添えて onTap が呼ばれる", () => {
      // setPointerCapture 後の pointerup はキャプチャ要素へ再ターゲットされる
      // ため、タップが写真の上か背景かの判定に使うヒット要素は pointerdown の
      // ものを引き渡す契約(ファサード側がズーム/クローズを分岐する)
      const { imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onTap).toHaveBeenCalledTimes(1);
      expect(callbacks.onTap).toHaveBeenCalledWith(imgWrap);
      expect(callbacks.onSwipeEnd).not.toHaveBeenCalled();
    });

    it("スマホでは直近のスワイプ終了から500ms以内の移動0リリースで onTap が呼ばれる", () => {
      const { imgWrap, callbacks } = buildHarness({}, { smartPhone: true });
      // 直近のスワイプ完了(タップ秒基準の更新)を発生させる
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 300, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 150, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 150, clientY: 100 }),
      );
      callbacks.onTap.mockClear();
      callbacks.onSwipeEnd.mockClear();

      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onTap).toHaveBeenCalledTimes(1);
    });

    it("スマホで直近のスワイプから時間が経っていれば移動0でも stay として扱う", () => {
      const { imgWrap, callbacks } = buildHarness({}, { smartPhone: true });
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 300, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 150, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 150, clientY: 100 }),
      );
      callbacks.onTap.mockClear();
      callbacks.onSwipeEnd.mockClear();

      vi.advanceTimersByTime(600);

      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onTap).not.toHaveBeenCalled();
    });
  });

  describe("ピンチ", () => {
    it("2本指で開始し距離が離れるとズームインする", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 120,
          clientY: 100,
        }),
      );
      expect(callbacks.onGestureStart).toHaveBeenCalledTimes(1);
      expect(state.viewer.scale).toBe(true);

      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 220,
          clientY: 100,
        }),
      );
      expect(state.viewer.scaleSize).toBeGreaterThan(1);
      vi.advanceTimersByTime(16);
      expect(callbacks.onGestureMove).toHaveBeenCalled();
    });

    it("複数回のpointermoveでもonGestureMoveは1フレームに1回だけ呼ばれる", () => {
      const { callbacks, imgWrap } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 120,
          clientY: 100,
        }),
      );
      for (let i = 0; i < 5; i += 1) {
        imgWrap.dispatchEvent(
          pointerEvent("pointermove", {
            pointerId: 2,
            clientX: 120 + i,
            clientY: 100,
          }),
        );
      }
      expect(callbacks.onGestureMove).not.toHaveBeenCalled();
      vi.advanceTimersByTime(16);
      expect(callbacks.onGestureMove).toHaveBeenCalledTimes(1);
    });

    it("scaleSize は 0.2 未満にならない", () => {
      const { state, imgWrap } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 500,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 101,
          clientY: 100,
        }),
      );
      expect(state.viewer.scaleSize).toBe(0.2);
    });

    it("ピンチ中は hideUi になる", () => {
      const { state, imgWrap } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 500,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 101,
          clientY: 100,
        }),
      );
      expect(state.viewer.hideUi).toBe(true);
    });

    it("指を離してもボーダー以下ならズーム状態を解除する", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 120,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onGestureEnd).toHaveBeenCalledTimes(1);
      expect(state.viewer.scale).toBe(false);
      expect(state.viewer.scaleSize).toBe(1);
    });

    it("指を離しても基準倍率以上ならズームを維持し、上限(fitの4倍)でクランプする", () => {
      // PhotoSwipe の maxZoomLevel(fit の4倍)相当。上限を超えて広げたまま
      // 離した場合は上限倍率へ戻し、ズーム自体は維持する
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 500,
          clientY: 100,
        }),
      );
      // dist 400 → 1700(比率 4.25)で上限 4 を超える
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 1800,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      expect(state.viewer.scale).toBe(true);
      expect(state.viewer.scaleSize).toBe(4);
      expect(callbacks.onGestureEnd).toHaveBeenCalledTimes(1);
      expect(callbacks.onPinchClose).not.toHaveBeenCalled();
    });

    it("基準倍率(フィット)以上・上限以下で離すとその倍率を維持する", () => {
      // 業界標準(PhotoSwipe / iOS 写真)ではフィット以上のズームは離しても
      // 維持される。旧実装はスマホの fill 倍率(scaleBorder)未満をすべて
      // フィットへ戻していたため、「中途半端に拡大すると勝手に戻される」
      // 体感になっていた
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 800,
        configurable: true,
      });
      try {
        const { state, imgWrap, callbacks } = buildHarness(
          {},
          { smartPhone: true },
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 2,
            clientX: 200,
            clientY: 100,
          }),
        );
        // dist 100 → 150(比率 1.5)。旧実装の境界 = fill 倍率 5 未満
        imgWrap.dispatchEvent(
          pointerEvent("pointermove", {
            pointerId: 2,
            clientX: 250,
            clientY: 100,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerup", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        expect(state.viewer.scale).toBe(true);
        expect(state.viewer.scaleSize).toBe(1.5);
        expect(state.viewer.hideUi).toBe(true);
        expect(callbacks.onGestureEnd).toHaveBeenCalledTimes(1);
      } finally {
        delete (document.documentElement as { clientWidth?: number })
          .clientWidth;
        delete (document.documentElement as { clientHeight?: number })
          .clientHeight;
      }
    });

    it("維持して離した際、パンが可動域外なら弾性で収める", () => {
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 600,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 600,
        configurable: true,
      });
      try {
        const { state, imgWrap, callbacks } = buildHarness();
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 2,
            clientX: 200,
            clientY: 100,
          }),
        );
        // dist 100 → 400(比率 4)で scaleSize 4(可視 800 > 画面 600)
        imgWrap.dispatchEvent(
          pointerEvent("pointermove", {
            pointerId: 2,
            clientX: 500,
            clientY: 100,
          }),
        );
        // 可動域(±100)を超える位置で離す
        state.viewer.photoPosX = 500;
        state.viewer.photoPosY = 0;
        imgWrap.dispatchEvent(
          pointerEvent("pointerup", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        expect(state.viewer.scaleSize).toBe(4);
        expect(state.viewer.photoPosX).toBe(100);
        expect(state.viewer.elastic).toBe(true);
        expect(callbacks.onGestureEnd).toHaveBeenCalledTimes(1);
      } finally {
        delete (document.documentElement as { clientWidth?: number })
          .clientWidth;
        delete (document.documentElement as { clientHeight?: number })
          .clientHeight;
      }
    });

    it("フィット未満(基準の3/4以上)で離すとフィットへ戻る", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 500,
          clientY: 100,
        }),
      );
      // dist 400 → 380(比率 0.95)。閉じる閾値 0.75 は下回らない
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 480,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      expect(state.viewer.scale).toBe(false);
      expect(state.viewer.scaleSize).toBe(1);
      expect(state.viewer.photoPosX).toBe(0);
      expect(state.viewer.hideUi).toBe(false);
      expect(callbacks.onGestureEnd).toHaveBeenCalledTimes(1);
      expect(callbacks.onPinchClose).not.toHaveBeenCalled();
    });

    it("基準の3/4より小さく縮めて離すと onPinchClose を通知する", () => {
      // PhotoSwipe の pinchToClose(既定 true)相当。フィットよりはっきり
      // 小さく縮めた状態で離すのは「閉じたい」操作とみなす
      const { imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 500,
          clientY: 100,
        }),
      );
      // dist 400 → 280(比率 0.7)で閉じる閾値 0.75 を下回る
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 380,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onPinchClose).toHaveBeenCalledTimes(1);
      expect(callbacks.onGestureEnd).not.toHaveBeenCalled();
    });

    it("pinchToClose: false なら大きく縮めて離してもフィットへ戻るだけ", () => {
      const { state, imgWrap, callbacks } = buildHarness({
        pinchToClose: false,
      });
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 500,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 380,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onPinchClose).not.toHaveBeenCalled();
      expect(state.viewer.scaleSize).toBe(1);
      expect(state.viewer.scale).toBe(false);
    });

    it("ピンチの中点を基準に拡大する(中点直下の絵柄が指に追従する)", () => {
      // 業界標準(PhotoSwipe / iOS 写真)では、ピンチした場所へ向かって
      // 拡大される。旧実装は常に画像中心基準だったため、見たい場所を
      // ピンチしても中心が拡大されるだけだった
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 800,
        configurable: true,
      });
      try {
        const { state, imgWrap } = buildHarness();
        // 画像中心 = (cx, cy) = (500, 60 + (800-120)/2) = (500, 400)
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 1,
            clientX: 600,
            clientY: 400,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 2,
            clientX: 800,
            clientY: 400,
          }),
        );
        // dist 200 → 400(比率 2)で scaleSize 2。中点は (800, 400)
        imgWrap.dispatchEvent(
          pointerEvent("pointermove", {
            pointerId: 2,
            clientX: 1000,
            clientY: 400,
          }),
        );
        expect(state.viewer.scaleSize).toBe(2);
        // 中点直下の絵柄(中心から +300px)が拡大後も中点に残るよう、
        // 画像中心は 800 - 300×2 = 200 → photoPosX = 200 - 500 = -300
        expect(state.viewer.photoPosX).toBe(-300);
        expect(state.viewer.photoPosY).toBe(0);
      } finally {
        delete (document.documentElement as { clientWidth?: number })
          .clientWidth;
        delete (document.documentElement as { clientHeight?: number })
          .clientHeight;
      }
    });

    it("ページがスクロールされていても、ピンチの中点はビューポート座標で扱う", () => {
      // getPos() は pageX/pageY を返すが、スワイプ量などの「差分」利用と違い、
      // 中点基準ズームは画像中心(ビューポート座標)との「絶対位置」比較になる。
      // ページ座標のままだとスクロール量が上乗せされ、スクロールした状態で
      // 開いてピンチすると画像がスクロール量ぶん大きく上へ飛んでしまう
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 800,
        configurable: true,
      });
      try {
        const { state, imgWrap } = buildHarness();
        const scrolled = (
          type: string,
          props: { pointerId: number; clientX: number; clientY: number },
        ) => {
          const ev = pointerEvent(type, props);
          // ページが (300, 600) スクロールされている状態を模す
          Object.defineProperty(ev, "pageX", { value: props.clientX + 300 });
          Object.defineProperty(ev, "pageY", { value: props.clientY + 600 });
          return ev;
        };
        imgWrap.dispatchEvent(
          scrolled("pointerdown", { pointerId: 1, clientX: 600, clientY: 400 }),
        );
        imgWrap.dispatchEvent(
          scrolled("pointerdown", { pointerId: 2, clientX: 800, clientY: 400 }),
        );
        imgWrap.dispatchEvent(
          scrolled("pointermove", {
            pointerId: 2,
            clientX: 1000,
            clientY: 400,
          }),
        );
        // スクロールしていない場合(上記の中点基準テスト)と同じ結果になること
        expect(state.viewer.scaleSize).toBe(2);
        expect(state.viewer.photoPosX).toBe(-300);
        expect(state.viewer.photoPosY).toBe(0);
      } finally {
        delete (document.documentElement as { clientWidth?: number })
          .clientWidth;
        delete (document.documentElement as { clientHeight?: number })
          .clientHeight;
      }
    });

    it("resizeStyle: 'fill' では fill 倍率が基準になる", () => {
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 800,
        configurable: true,
      });
      try {
        const { state, imgWrap, callbacks } = buildHarness(
          { resizeStyle: "fill" },
          { smartPhone: true },
        );
        // 横長 400×300 → fill 倍率(基準) = 800/300 = 2.666…
        state.groups.get("g1")?.forEach((item) => {
          item.width = 400;
          item.height = 300;
        });
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 2,
            clientX: 200,
            clientY: 100,
          }),
        );
        // dist 100 → 240(比率 2.4)。基準未満だが 3/4 = 2.0 以上
        imgWrap.dispatchEvent(
          pointerEvent("pointermove", {
            pointerId: 2,
            clientX: 340,
            clientY: 100,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerup", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        // fill の基準倍率へスプリングバックする(フィットの 1 ではなく)
        expect(state.viewer.scaleSize).toBeCloseTo(800 / 300, 5);
        expect(state.viewer.photoPosX).toBe(0);
        expect(state.viewer.scale).toBe(true);
        expect(state.viewer.hideUi).toBe(true);
        expect(callbacks.onGestureEnd).toHaveBeenCalledTimes(1);
        expect(callbacks.onPinchClose).not.toHaveBeenCalled();
      } finally {
        delete (document.documentElement as { clientWidth?: number })
          .clientWidth;
        delete (document.documentElement as { clientHeight?: number })
          .clientHeight;
      }
    });

    it("倍率は指の距離の比率に追従する(ズーム状態からのピンチインで急落しない)", () => {
      // 旧実装は距離の「差分」で線形に倍率を動かしていた(100px で ±1.0)ため、
      // 高倍率から戻すピンチインで一気に閉じる閾値まで突き抜けていた。
      // 業界標準(PhotoSwipe / iOS 写真)の「開始倍率 × 現距離/開始距離」に合わせる
      const { state, imgWrap } = buildHarness();
      state.viewer.scale = true;
      state.viewer.scaleSize = 3;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 500,
          clientY: 100,
        }),
      );
      // dist 400 → 200(比率 0.5): 3 × 0.5 = 1.5(旧線形なら 3 - 2 = 1.0)
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 300,
          clientY: 100,
        }),
      );
      expect(state.viewer.scaleSize).toBe(1.5);
    });

    it("閉じる閾値ちょうど(基準の3/4)では閉じずフィットへ戻る", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 500,
          clientY: 100,
        }),
      );
      // dist 400 → 300(比率 0.75 = 閾値ちょうど。「未満」ではないので閉じない)
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 400,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onPinchClose).not.toHaveBeenCalled();
      expect(state.viewer.scaleSize).toBe(1);
      expect(callbacks.onGestureEnd).toHaveBeenCalledTimes(1);
    });

    it("resizeStyle: 'fill' でも基準の3/4より小さく縮めて離すと onPinchClose を通知する", () => {
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 800,
        configurable: true,
      });
      try {
        const { state, imgWrap, callbacks } = buildHarness(
          { resizeStyle: "fill" },
          { smartPhone: true },
        );
        // 横長 400×300 → fill 倍率(基準) = 800/300 = 2.666… → 閾値 = 2.0
        state.groups.get("g1")?.forEach((item) => {
          item.width = 400;
          item.height = 300;
        });
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 2,
            clientX: 200,
            clientY: 100,
          }),
        );
        // dist 100 → 190(比率 1.9)。基準 2.666… の 3/4 = 2.0 を下回る
        imgWrap.dispatchEvent(
          pointerEvent("pointermove", {
            pointerId: 2,
            clientX: 290,
            clientY: 100,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerup", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        expect(callbacks.onPinchClose).toHaveBeenCalledTimes(1);
        expect(callbacks.onGestureEnd).not.toHaveBeenCalled();
      } finally {
        delete (document.documentElement as { clientWidth?: number })
          .clientWidth;
        delete (document.documentElement as { clientHeight?: number })
          .clientHeight;
      }
    });

    it("維持して離した際、パンが縦方向の可動域外でも弾性で収める", () => {
      Object.defineProperty(document.documentElement, "clientWidth", {
        value: 600,
        configurable: true,
      });
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 600,
        configurable: true,
      });
      try {
        const { state, imgWrap, callbacks } = buildHarness();
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 2,
            clientX: 200,
            clientY: 100,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointermove", {
            pointerId: 2,
            clientX: 500,
            clientY: 100,
          }),
        );
        state.viewer.photoPosX = 0;
        state.viewer.photoPosY = -500;
        imgWrap.dispatchEvent(
          pointerEvent("pointerup", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        expect(state.viewer.photoPosY).toBe(-100);
        expect(state.viewer.elastic).toBe(true);
        expect(callbacks.onGestureEnd).toHaveBeenCalledTimes(1);
      } finally {
        delete (document.documentElement as { clientWidth?: number })
          .clientWidth;
        delete (document.documentElement as { clientHeight?: number })
          .clientHeight;
      }
    });

    it("2本の指が同一座標で開始しても例外を出さず倍率を変えない", () => {
      const { state, imgWrap } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 100,
          clientY: 100,
        }),
      );
      expect(() =>
        imgWrap.dispatchEvent(
          pointerEvent("pointermove", {
            pointerId: 2,
            clientX: 150,
            clientY: 100,
          }),
        ),
      ).not.toThrow();
      // 開始距離 0 では比率を計算できないため倍率は変えない(NaN/Infinity を防ぐ)
      expect(state.viewer.scaleSize).toBe(1);
      expect(Number.isFinite(state.viewer.photoPosX)).toBe(true);
    });

    it("pointercancel でもピンチが正しく終了する", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 200,
          clientY: 100,
        }),
      );
      // dist 100 → 150(比率 1.5)
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 250,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointercancel", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      expect(state.viewer.scale).toBe(true);
      expect(state.viewer.scaleSize).toBe(1.5);
      expect(callbacks.onGestureEnd).toHaveBeenCalledTimes(1);
    });

    it("ピンチ終了後、残った指の move でスライドリストを誤ってスワイプしない", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 200,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 250,
          clientY: 100,
        }),
      );
      // 1本目を離した時点でピンチは終了(ズーム維持)。残った2本目の指の
      // move がスワイプ(リスト送り)や photoPos の暴発につながらないこと
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      const posX = state.viewer.photoPosX;
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 400,
          clientY: 100,
        }),
      );
      expect(callbacks.onSwipeStart).not.toHaveBeenCalled();
      expect(callbacks.onSwipeMove).not.toHaveBeenCalled();
      expect(state.viewer.translateX).toBe(0);
      expect(state.viewer.photoPosX).toBe(posX);
      // 残った指を離しても zoom-out やタップ扱いにならない
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 2, clientX: 400, clientY: 100 }),
      );
      expect(callbacks.onPhotoDragEnd).not.toHaveBeenCalled();
      expect(callbacks.onTap).not.toHaveBeenCalled();
      expect(state.viewer.scale).toBe(true);
    });

    it("ズーム維持後にあらためて1本指を置けば写真をパンできる", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 200,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 300,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 2, clientX: 300, clientY: 100 }),
      );
      const posX = state.viewer.photoPosX;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 3,
          clientX: 200,
          clientY: 200,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 3,
          clientX: 260,
          clientY: 200,
        }),
      );
      expect(callbacks.onPhotoDragMove).toHaveBeenCalled();
      expect(state.viewer.photoPosX).not.toBe(posX);
    });

    it("3本指から1本離した際は現在の距離を基準に引き継ぐ(倍率が跳ばない)", () => {
      const { state, imgWrap } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { pointerId: 2, clientX: 100, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { pointerId: 3, clientX: 200, clientY: 0 }),
      );
      // ピンチ対象は先頭2本(dist 100)。id2 を 150 へ → 比率 1.5
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { pointerId: 2, clientX: 150, clientY: 0 }),
      );
      expect(state.viewer.scaleSize).toBe(1.5);
      // id2 を離すと残りは id1(0,0) と id3(200,0) = dist 200。
      // ここを新たな基準にしないと、次の move で倍率が不連続に跳ぶ
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 2, clientX: 150, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { pointerId: 3, clientX: 250, clientY: 0 }),
      );
      // dist 200 → 250(比率 1.25): 1.5 × 1.25 = 1.875
      expect(state.viewer.scaleSize).toBe(1.875);
    });

    it("ピンチ開始で前回のドラッグ慣性(vx/vy)がリセットされる", () => {
      const { state, imgWrap } = buildHarness();
      // まずタップズーム相当の状態にして、勢いのあるドラッグで慣性を残す
      state.viewer.scale = true;
      state.viewer.scaleSize = 2;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 300, clientY: 300 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 250, clientY: 300 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 250, clientY: 300 }),
      );
      // ピンチで拡大して維持
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 200,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 300,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 2, clientX: 300, clientY: 100 }),
      );
      // 慣性ループ(forceInterval=10ms)を進めても、ピンチ前のドラッグの勢いで
      // 写真が勝手に流れていかないこと
      const posX = state.viewer.photoPosX;
      const posY = state.viewer.photoPosY;
      vi.advanceTimersByTime(100);
      expect(state.viewer.photoPosX).toBe(posX);
      expect(state.viewer.photoPosY).toBe(posY);
    });

    it("上限倍率の判定は clientHeight より visualViewport.height を優先する", () => {
      // iOS Safari ではアドレスバーの表示/非表示で実ビューポートが変わるが、
      // documentElement.clientHeight は追従しない。ファサード側の zoomPhoto()
      // (getWindowHeight = visualViewport 優先)と同じ基準で判定しないと、
      // タップズーム(scaleBorder)とピンチの上限倍率が食い違う
      const { state, imgWrap } = buildHarness({}, { smartPhone: true });
      // 横長画像: scaleBorder = winHeight / (item.height * item.scale)
      state.groups.get("g1")?.forEach((item) => {
        item.width = 400;
        item.height = 300;
      });
      // 上限 = max(4, scaleBorder)。clientHeight(1800) 基準なら scaleBorder=6 で
      // scaleSize 5 は維持、visualViewport(1200) 基準なら scaleBorder=4 で
      // 上限 4 にクランプされるはず
      Object.defineProperty(document.documentElement, "clientHeight", {
        value: 1800,
        configurable: true,
      });
      Object.defineProperty(window, "visualViewport", {
        value: { height: 1200, scale: 1 },
        configurable: true,
        writable: true,
      });
      try {
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        imgWrap.dispatchEvent(
          pointerEvent("pointerdown", {
            pointerId: 2,
            clientX: 200,
            clientY: 100,
          }),
        );
        // 距離 100 → 500(比率 5)で scaleSize 5
        imgWrap.dispatchEvent(
          pointerEvent("pointermove", {
            pointerId: 2,
            clientX: 600,
            clientY: 100,
          }),
        );
        expect(state.viewer.scaleSize).toBeCloseTo(5, 5);
        imgWrap.dispatchEvent(
          pointerEvent("pointerup", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        );
        expect(state.viewer.scale).toBe(true);
        expect(state.viewer.scaleSize).toBe(4);
      } finally {
        delete (window as { visualViewport?: unknown }).visualViewport;
        delete (
          document.documentElement as unknown as { clientHeight?: number }
        ).clientHeight;
      }
    });

    it("指を離した瞬間、保留中だった最終フレームのonGestureMoveが同期的に反映される", () => {
      const { imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 500,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 1000,
          clientY: 100,
        }),
      );
      // rAFはまだ発火していない(フレームを進めていない)ため、この時点では未反映
      expect(callbacks.onGestureMove).not.toHaveBeenCalled();
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      // 指を離した瞬間、保留中のフレームが即時反映され、見た目が最終stateに追従する
      // (単にcancelしていた旧実装では、ここでonGestureMoveが呼ばれず、
      // ズーム後の画像が1フレーム前の位置/スケールのまま固定される不整合があった)
      expect(callbacks.onGestureMove).toHaveBeenCalledTimes(1);
    });
  });

  describe("ズーム中の画像ドラッグ", () => {
    const zoomedHarness = () => {
      const harness = buildHarness();
      harness.state.viewer.scale = true;
      harness.state.viewer.scaleSize = 2;
      return harness;
    };

    it("横方向にドラッグすると photoPosX が動く", () => {
      const { state, imgWrap, callbacks } = zoomedHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 150, clientY: 100 }),
      );
      expect(callbacks.onPhotoDragMove).toHaveBeenCalled();
      expect(state.viewer.photoPosX).toBe(100);
    });

    it("x/y ともに移動が無いリリース(タップ)は zoom-out として扱う", () => {
      const { imgWrap, callbacks } = zoomedHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith("zoom-out");
    });

    it("縦方向のみのドラッグは zoom-out ではなく通常のドラッグ終了として扱う", () => {
      // 旧実装は x 座標の一致だけで「移動なし=タップ」と判定していたため、
      // まっすぐ縦にパンした(x が変わらない)だけでズームが全解除され、
      // 見ていた場所から fit 表示まで一気に戻ってしまっていた
      const { state, imgWrap, callbacks } = zoomedHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 300 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onPhotoDragEnd).not.toHaveBeenCalledWith("zoom-out");
      expect(state.viewer.photoPosY).not.toBe(0);
    });

    it("境界を超えてドラッグすると next/prev を通知する", () => {
      const { state, imgWrap, callbacks } = zoomedHarness();
      state.viewer.currentIndex = 1;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 1000, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith("next");
    });

    it("境界内で収まる小さな移動は慣性の初速だけを設定して null を通知する", () => {
      const { imgWrap, callbacks } = zoomedHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 105, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 105, clientY: 100 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith(null);
    });
  });

  describe("慣性ループ", () => {
    it("scale中で何も操作していなければ photoPos が velocity に応じて動く", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      state.viewer.scale = true;
      state.viewer.scaleSize = 2;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 1000, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 950, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 950, clientY: 100 }),
      );
      callbacks.onPhotoDragMove.mockClear();
      vi.advanceTimersByTime(50);
      expect(callbacks.onPhotoDragMove).toHaveBeenCalled();
    });

    it("scale していなければ何もしない", () => {
      const { callbacks } = buildHarness();
      callbacks.onPhotoDragMove.mockClear();
      vi.advanceTimersByTime(50);
      expect(callbacks.onPhotoDragMove).not.toHaveBeenCalled();
    });

    it("forceInterval を長くすると tick 間隔が伸びる", () => {
      const { state, imgWrap, callbacks } = buildHarness({
        forceInterval: 200,
      });
      state.viewer.scale = true;
      state.viewer.scaleSize = 2;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 1000, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 950, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 950, clientY: 100 }),
      );
      callbacks.onPhotoDragMove.mockClear();
      // デフォルト(10ms)なら発火するはずの 50ms 時点ではまだ tick していない
      vi.advanceTimersByTime(50);
      expect(callbacks.onPhotoDragMove).not.toHaveBeenCalled();
      vi.advanceTimersByTime(150);
      expect(callbacks.onPhotoDragMove).toHaveBeenCalled();
    });

    it("registance が初速を上回ると慣性が働かない", () => {
      // ドラッグにより初速 force=20 が設定される(scaleSize=2 × 50px 移動 ÷ 5)。
      // registance をそれ以上にすると初回 tick で force が 0.5 未満になり、
      // onPhotoDragMove を一度も呼ばずに慣性ループが止まることを確認する
      const { state, imgWrap, callbacks } = buildHarness({ registance: 20 });
      state.viewer.scale = true;
      state.viewer.scaleSize = 2;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 1000, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 950, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 950, clientY: 100 }),
      );
      callbacks.onPhotoDragMove.mockClear();
      vi.advanceTimersByTime(50);
      expect(callbacks.onPhotoDragMove).not.toHaveBeenCalled();
    });
  });

  describe("加速度センサー", () => {
    it("useOrientationApi が有効なら deviceorientation で photoPos が動く", () => {
      const { state, callbacks } = buildHarness({ useOrientationApi: true });
      state.viewer.scale = true;
      (window as unknown as { orientation: number }).orientation = 0;
      const before = state.viewer.photoPosX;
      window.dispatchEvent(orientationEvent({ gamma: 50, beta: 0 }));
      vi.advanceTimersByTime(50);
      expect(callbacks.onPhotoDragMove).toHaveBeenCalled();
      expect(state.viewer.photoPosX).not.toBe(before);
    });

    it("useOrientationApi が無効なら deviceorientation を購読しない", () => {
      const { callbacks } = buildHarness({ useOrientationApi: false });
      (window as unknown as { orientation: number }).orientation = 0;
      window.dispatchEvent(orientationEvent({ gamma: 10, beta: 0 }));
      vi.advanceTimersByTime(50);
      expect(callbacks.onPhotoDragMove).not.toHaveBeenCalled();
    });

    it("gamma が無いイベントは無視する", () => {
      const { callbacks } = buildHarness({ useOrientationApi: true });
      window.dispatchEvent(orientationEvent({}));
      vi.advanceTimersByTime(50);
      expect(callbacks.onPhotoDragMove).not.toHaveBeenCalled();
    });

    it("verticalGravity が有効なら beta も速度に反映する", () => {
      const { state } = buildHarness({
        useOrientationApi: true,
        verticalGravity: true,
      });
      state.viewer.scale = true;
      (window as unknown as { orientation: number }).orientation = 0;
      window.dispatchEvent(orientationEvent({ gamma: 10, beta: 10 }));
      vi.advanceTimersByTime(50);
      expect(state.viewer.photoPosY).not.toBe(0);
    });

    it("orientation が 90/-90/180 のときも軸を入れ替えて反映する", () => {
      const { state } = buildHarness({
        useOrientationApi: true,
        verticalGravity: true,
      });
      state.viewer.scale = true;
      for (const orientation of [90, -90, 180]) {
        (window as unknown as { orientation: number }).orientation =
          orientation;
        window.dispatchEvent(orientationEvent({ gamma: 10, beta: 10 }));
      }
      vi.advanceTimersByTime(50);
      expect(state.viewer.photoPosX).not.toBe(0);
    });

    it("未知の orientation 値では何も反映しない", () => {
      const { state } = buildHarness({ useOrientationApi: true });
      state.viewer.scale = true;
      (window as unknown as { orientation: number }).orientation = 270;
      window.dispatchEvent(orientationEvent({ gamma: 50, beta: 50 }));
      vi.advanceTimersByTime(50);
      // 慣性ループの摩擦だけによる微小なドリフト以上には動かない(重力未反映)
      expect(Math.abs(state.viewer.photoPosX)).toBeLessThan(3);
    });

    it("gamma/beta が ±5 の範囲内なら速度に反映しない", () => {
      const { state } = buildHarness({
        useOrientationApi: true,
        verticalGravity: true,
      });
      state.viewer.scale = true;
      (window as unknown as { orientation: number }).orientation = 0;
      window.dispatchEvent(orientationEvent({ gamma: 3, beta: 3 }));
      vi.advanceTimersByTime(50);
      expect(Math.abs(state.viewer.photoPosX)).toBeLessThan(3);
      expect(Math.abs(state.viewer.photoPosY)).toBeLessThan(3);
    });

    it("gamma/beta が負方向に大きい場合も速度に反映する", () => {
      const { state, callbacks } = buildHarness({
        useOrientationApi: true,
        verticalGravity: true,
      });
      state.viewer.scale = true;
      (window as unknown as { orientation: number }).orientation = 0;
      window.dispatchEvent(orientationEvent({ gamma: -50, beta: -50 }));
      vi.advanceTimersByTime(50);
      expect(callbacks.onPhotoDragMove).toHaveBeenCalled();
    });
  });

  describe("防御的なガード", () => {
    it("setPointerCapture が例外を投げても以降の処理を継続する", () => {
      const { content, callbacks } = buildHarness();
      const original = content.setPointerCapture;
      content.setPointerCapture = () => {
        throw new DOMException("no active pointer", "NotFoundError");
      };
      try {
        content.dispatchEvent(
          pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        content.dispatchEvent(
          pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
        );
      } finally {
        content.setPointerCapture = original;
      }
      expect(callbacks.onTap).toHaveBeenCalledTimes(1);
    });

    it("attach() は複数要素に束縛できる(content と list は兄弟要素で片方は他方の子孫ではないため)", () => {
      const { gestures, callbacks, controller } = buildHarness();
      // buildHarness の attach(content) に加え、content とは無関係な兄弟要素にも束縛する
      const list = document.createElement("ul");
      document.body.appendChild(list);
      gestures.attach(list);

      list.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 50, clientY: 50 }),
      );
      list.dispatchEvent(
        pointerEvent("pointerup", { clientX: 50, clientY: 50 }),
      );

      expect(callbacks.onTap).toHaveBeenCalledTimes(1);
      controller.abort();
    });

    it("pointerdown を伴わない pointermove は無視する", () => {
      const { content, callbacks } = buildHarness();
      content.dispatchEvent(
        pointerEvent("pointermove", { clientX: 10, clientY: 10 }),
      );
      expect(callbacks.onSwipeMove).not.toHaveBeenCalled();
    });

    it("pointerdown を伴わない pointerup は何もしない", () => {
      const { content, callbacks } = buildHarness();
      expect(() =>
        content.dispatchEvent(
          pointerEvent("pointerup", { clientX: 10, clientY: 10 }),
        ),
      ).not.toThrow();
      expect(callbacks.onSwipeEnd).not.toHaveBeenCalled();
      expect(callbacks.onTap).not.toHaveBeenCalled();
    });

    it("3本指ピンチで1本離してもピンチを継続する", () => {
      const { imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { pointerId: 2, clientX: 100, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { pointerId: 3, clientX: 200, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 3, clientX: 200, clientY: 0 }),
      );
      expect(callbacks.onGestureEnd).not.toHaveBeenCalled();
    });

    it("ピンチ中に currentItem が無くなっても movePinch は落ちない", () => {
      const { state, imgWrap } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 120,
          clientY: 100,
        }),
      );
      state.groups.clear();
      expect(() =>
        imgWrap.dispatchEvent(
          pointerEvent("pointermove", {
            pointerId: 2,
            clientX: 220,
            clientY: 100,
          }),
        ),
      ).not.toThrow();
    });

    it("スワイプ中の2回目以降の移動は onSwipeStart を再度呼ばない", () => {
      const { imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 300, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 250, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 200, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 200, clientY: 100 }),
      );
      expect(callbacks.onSwipeStart).toHaveBeenCalledTimes(1);
    });

    it("スワイプ終了時に currentItems が無くても next 判定できる", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 300, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 150, clientY: 100 }),
      );
      state.groups.clear();
      expect(() =>
        imgWrap.dispatchEvent(
          pointerEvent("pointerup", { clientX: 150, clientY: 100 }),
        ),
      ).not.toThrow();
      expect(callbacks.onSwipeEnd).toHaveBeenCalledWith("next");
    });

    it("currentItem が無い場合ピンチ終了は何もしない", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 120,
          clientY: 100,
        }),
      );
      state.groups.clear();
      expect(() =>
        imgWrap.dispatchEvent(
          pointerEvent("pointerup", {
            pointerId: 1,
            clientX: 100,
            clientY: 100,
          }),
        ),
      ).not.toThrow();
      expect(callbacks.onGestureEnd).not.toHaveBeenCalled();
    });

    it("currentItem が無い場合フォトドラッグ終了は null を通知する", () => {
      const { state, imgWrap, callbacks } = buildHarness();
      state.viewer.scale = true;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      state.groups.clear();
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 150, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 150, clientY: 100 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith(null);
    });

    it("currentItem が無い場合弾性ループは何もしない", () => {
      const { state, imgWrap } = buildHarness();
      state.viewer.scale = true;
      state.viewer.scaleSize = 2;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 1000, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 950, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 950, clientY: 100 }),
      );
      state.groups.clear();
      expect(() => vi.advanceTimersByTime(50)).not.toThrow();
    });
  });

  describe("反対方向の境界とその場に留まる弾性", () => {
    const zoomedHarness = () => {
      const harness = buildHarness();
      harness.state.viewer.scale = true;
      harness.state.viewer.scaleSize = 2;
      return harness;
    };

    it("反対方向にドラッグしても閾値未満なら弾性で戻す(縦方向含む)", () => {
      const { state, imgWrap, callbacks } = zoomedHarness();
      // item 200x200(scale=1), scaleSize=2, jsdom の window サイズは 0 のため
      // 可視サイズ 400 → bound.maxX/maxY は (400-0)/2 ÷ item.scale(1) = 200。
      // 350 は maxX/maxY を超えるが offset(swipeOffset(100)*scaleSize(2)=200)
      // 以内のオーバーランなので弾性で戻る対象になる。
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 0, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 10, clientY: 10 }),
      );
      state.viewer.photoPosX = 350;
      state.viewer.photoPosY = 350;
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 10, clientY: 10 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith(null);
      expect(state.viewer.elastic).toBe(true);
    });

    it("負方向にも閾値未満のオーバーランは弾性で戻す", () => {
      const { state, imgWrap, callbacks } = zoomedHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 0, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 10, clientY: 10 }),
      );
      state.viewer.photoPosX = -350;
      state.viewer.photoPosY = -350;
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 10, clientY: 10 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith(null);
      expect(state.viewer.elastic).toBe(true);
      expect(state.viewer.photoPosX).toBeGreaterThan(-350);
      expect(state.viewer.photoPosY).toBeGreaterThan(-350);

      // 300ms後に弾性状態を解除する
      vi.advanceTimersByTime(300);
      expect(state.viewer.elastic).toBe(false);
    });

    it("片方の軸だけが閾値未満でオーバーランしても弾性で戻す", () => {
      const { state, imgWrap, callbacks } = zoomedHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 0, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 10, clientY: 10 }),
      );
      state.viewer.photoPosX = 0;
      state.viewer.photoPosY = 350;
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 10, clientY: 10 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith(null);
      expect(state.viewer.photoPosX).toBe(0);
    });

    it("もう片方の軸だけが閾値未満でオーバーランしても弾性で戻す", () => {
      const { state, imgWrap, callbacks } = zoomedHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 0, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 10, clientY: 10 }),
      );
      state.viewer.photoPosX = 350;
      state.viewer.photoPosY = 0;
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 10, clientY: 10 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith(null);
      expect(state.viewer.photoPosY).toBe(0);
    });

    it("しきい値を超えた反対方向ドラッグは prev を通知する", () => {
      const { state, imgWrap, callbacks } = zoomedHarness();
      state.viewer.currentIndex = 1;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 1000, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 1000, clientY: 100 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith("prev");
    });
  });

  describe("慣性ループの境界クランプ", () => {
    it("正方向の大きな初速は maxX/maxY でクランプされ反発する", () => {
      const { state, imgWrap } = buildHarness();
      state.viewer.scale = true;
      state.viewer.scaleSize = 2;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 0, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 500, clientY: 500 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 500, clientY: 500 }),
      );
      vi.advanceTimersByTime(200);
      expect(Number.isFinite(state.viewer.photoPosX)).toBe(true);
      expect(Number.isFinite(state.viewer.photoPosY)).toBe(true);
    });

    it("負方向の大きな初速は minX/minY でクランプされ反発する", () => {
      const { state, imgWrap } = buildHarness();
      state.viewer.scale = true;
      state.viewer.scaleSize = 2;
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 500, clientY: 500 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 0, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 0, clientY: 0 }),
      );
      vi.advanceTimersByTime(200);
      expect(Number.isFinite(state.viewer.photoPosX)).toBe(true);
      expect(Number.isFinite(state.viewer.photoPosY)).toBe(true);
    });
  });

  describe("detach", () => {
    it("慣性ループを停止する", () => {
      const { state, gestures, callbacks } = buildHarness();
      state.viewer.scale = true;
      state.viewer.scaleSize = 2;
      gestures.detach();
      callbacks.onPhotoDragMove.mockClear();
      vi.advanceTimersByTime(100);
      expect(callbacks.onPhotoDragMove).not.toHaveBeenCalled();
    });

    it("ピンチ中に保留していたフレームもキャンセルする", () => {
      const { gestures, callbacks, imgWrap } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", {
          pointerId: 2,
          clientX: 120,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 220,
          clientY: 100,
        }),
      );
      // rAFはまだ発火していない(保留中)状態でdetachする
      expect(() => gestures.detach()).not.toThrow();
      callbacks.onGestureMove.mockClear();
      vi.advanceTimersByTime(16);
      // キャンセルされているため、detach後にonGestureMoveは呼ばれない
      expect(callbacks.onGestureMove).not.toHaveBeenCalled();
    });
  });
});
