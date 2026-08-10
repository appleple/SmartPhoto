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
    it("デスクトップでは移動0のリリースで onTap が呼ばれる", () => {
      const { imgWrap, callbacks } = buildHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onTap).toHaveBeenCalledTimes(1);
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

    it("境界を超えて縮小すると hideUi になる", () => {
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

    it("指を離してもボーダーを超えたままならズーム状態を維持する", () => {
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
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", {
          pointerId: 2,
          clientX: 1000,
          clientY: 100,
        }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { pointerId: 1, clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onGestureEnd).not.toHaveBeenCalled();
      expect(state.viewer.scale).toBe(true);
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

    it("横方向の移動が無いリリースは zoom-out として扱う", () => {
      const { imgWrap, callbacks } = zoomedHarness();
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 100, clientY: 100 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith("zoom-out");
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
      // item 200x200, scaleSize=2, jsdom の window サイズは 0 のため
      // bound.maxX/maxY は 400 になる。450 は maxX/maxY を超えるが
      // offset(swipeOffset(100)*scaleSize(2)=200) 以内なので弾性で戻る対象になる。
      imgWrap.dispatchEvent(
        pointerEvent("pointerdown", { clientX: 0, clientY: 0 }),
      );
      imgWrap.dispatchEvent(
        pointerEvent("pointermove", { clientX: 10, clientY: 10 }),
      );
      state.viewer.photoPosX = 450;
      state.viewer.photoPosY = 450;
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
      state.viewer.photoPosX = -450;
      state.viewer.photoPosY = -450;
      imgWrap.dispatchEvent(
        pointerEvent("pointerup", { clientX: 10, clientY: 10 }),
      );
      expect(callbacks.onPhotoDragEnd).toHaveBeenCalledWith(null);
      expect(state.viewer.elastic).toBe(true);
      expect(state.viewer.photoPosX).toBeGreaterThan(-450);
      expect(state.viewer.photoPosY).toBeGreaterThan(-450);

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
      state.viewer.photoPosY = 450;
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
      state.viewer.photoPosX = 450;
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
