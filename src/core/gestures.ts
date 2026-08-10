import * as util from "../lib/util";
import { currentItem, currentItems, makeBound, scaleBorder } from "./state";
import type { GestureCallbacks, Item, State } from "./types";

function round(val: number, precision: number): number {
  const digit = 10 ** precision;
  return Math.round(val * digit) / digit;
}

function getPos(e: PointerEvent): { x: number; y: number } {
  return { x: e.pageX, y: e.pageY };
}

function distance(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): number {
  const x = p1.x - p2.x;
  const y = p1.y - p2.y;
  return Math.sqrt(x * x + y * y);
}

function getForceAndTheta(
  x: number,
  y: number,
): { force: number; theta: number } {
  return { force: Math.sqrt(x * x + y * y), theta: Math.atan2(y, x) };
}

function windowSize(): { width: number; height: number } {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };
}

export interface CreateGesturesOptions {
  state: State;
  callbacks: GestureCallbacks;
}

export interface Gestures {
  attach(...targets: Element[]): void;
  detach(): void;
}

// Pointer Events(pointerdown/move/up/cancel)に統一した入力レイヤー。
// DOM には触らず、state.viewer の高頻度フィールド(translateX/Y, photoPosX/Y,
// scaleSize, scale, elastic, hideUi)を直接更新し、再描画・イベント発火・
// ナビゲーション判断は callbacks を通じてファサード側に委ねる(§6.1/§7)。
// 数式・閾値は旧 beforeDrag/onDrag/afterDrag 系からそのまま移植している。
export function createGestures(
  { state, callbacks }: CreateGesturesOptions,
  { signal }: { signal: AbortSignal },
): Gestures {
  const activePointers = new Map<number, { x: number; y: number }>();
  let tapSecond = Date.now();

  let swiping = false;
  let dragStart = false;
  let firstPos: { x: number; y: number } | null = null;
  let oldPos: { x: number; y: number } | null = null;
  let moveDir: "horizontal" | "vertical" | null = null;

  let photoSwipable = false;
  let firstPhotoPos: { x: number; y: number } | null = null;
  let oldPhotoPos: { x: number; y: number } | null = null;
  let photoVX = 0;
  let photoVY = 0;

  let pinching = false;
  let oldDistance = 0;

  let vx = 0;
  let vy = 0;

  function isSmartPhone(): boolean {
    return util.isSmartPhone();
  }

  function boundOf(item: Item) {
    const { width, height } = windowSize();
    return makeBound(item, state.viewer, width, height);
  }

  function borderOf(item: Item) {
    const { width, height } = windowSize();
    return scaleBorder(item, width, height, isSmartPhone());
  }

  // 呼び出し元(endPhotoDrag)が currentItem の存在を確認済みのため non-null が保証される
  function registerElasticForce(flagX: number, flagY: number): void {
    const item = currentItem(state) as Item;
    const bound = boundOf(item);
    state.viewer.elastic = true;
    if (flagX === 1) {
      state.viewer.photoPosX = bound.minX;
    } else if (flagX === -1) {
      state.viewer.photoPosX = bound.maxX;
    }
    if (flagY === 1) {
      state.viewer.photoPosY = bound.minY;
    } else if (flagY === -1) {
      state.viewer.photoPosY = bound.maxY;
    }
    callbacks.onPhotoDragMove();
    setTimeout(() => {
      state.viewer.elastic = false;
      callbacks.onPhotoDragMove();
    }, 300);
  }

  // 旧 _doAnim をそのまま移植した慣性ループ。コンポーネント生存期間中は常時稼働し、
  // 動かせる状態(scale中でドラッグ/ピンチ/弾性のいずれも進行していない)以外は早期returnする
  const interval = setInterval(() => {
    if (
      pinching ||
      swiping ||
      photoSwipable ||
      state.viewer.elastic ||
      !state.viewer.scale
    ) {
      return;
    }
    state.viewer.photoPosX += vx;
    state.viewer.photoPosY += vy;
    const item = currentItem(state);
    if (!item) {
      return;
    }
    const bound = boundOf(item);
    if (state.viewer.photoPosX < bound.minX) {
      state.viewer.photoPosX = bound.minX;
      vx *= -0.2;
    } else if (state.viewer.photoPosX > bound.maxX) {
      state.viewer.photoPosX = bound.maxX;
      vx *= -0.2;
    }
    if (state.viewer.photoPosY < bound.minY) {
      state.viewer.photoPosY = bound.minY;
      vy *= -0.2;
    } else if (state.viewer.photoPosY > bound.maxY) {
      state.viewer.photoPosY = bound.maxY;
      vy *= -0.2;
    }
    const power = getForceAndTheta(vx, vy);
    const force = power.force - state.options.registance;
    if (Math.abs(force) < 0.5) {
      return;
    }
    vx = Math.cos(power.theta) * force;
    vy = Math.sin(power.theta) * force;
    callbacks.onPhotoDragMove();
  }, state.options.forceInterval);

  function calcGravity(gamma: number, beta: number): void {
    if (gamma > 5 || gamma < -5) {
      vx += gamma * 0.05;
    }
    if (!state.options.verticalGravity) {
      return;
    }
    if (beta > 5 || beta < -5) {
      vy += beta * 0.05;
    }
  }

  function handleOrientationEvent(e: DeviceOrientationEvent): void {
    if (!e?.gamma || state.viewer.appearEffect) {
      return;
    }
    if (
      pinching ||
      swiping ||
      photoSwipable ||
      state.viewer.elastic ||
      !state.viewer.scale
    ) {
      return;
    }
    const { orientation } = window as Window & { orientation?: number };
    if (orientation === 0) {
      calcGravity(e.gamma, e.beta as number);
    } else if (orientation === 90) {
      calcGravity(e.beta as number, e.gamma);
    } else if (orientation === -90) {
      calcGravity(-(e.beta as number), -e.gamma);
    } else if (orientation === 180) {
      calcGravity(-e.gamma, -(e.beta as number));
    }
  }

  if (state.options.useOrientationApi) {
    window.addEventListener(
      "deviceorientation",
      handleOrientationEvent as EventListener,
      { signal },
    );
  }

  function startPinch(): void {
    pinching = true;
    swiping = false;
    photoSwipable = false;
    const points = Array.from(activePointers.values());
    oldDistance = distance(
      points[0] as { x: number; y: number },
      points[1] as { x: number; y: number },
    );
    state.viewer.scale = true;
    callbacks.onGestureStart();
  }

  function startSwipe(e: PointerEvent): void {
    const pos = getPos(e);
    swiping = true;
    dragStart = true;
    firstPos = pos;
    oldPos = pos;
  }

  function startPhotoDrag(e: PointerEvent): void {
    photoSwipable = true;
    const pos = getPos(e);
    oldPhotoPos = pos;
    firstPhotoPos = pos;
  }

  function onPointerDown(e: PointerEvent): void {
    // setPointerCapture は対象の pointerId が既に非アクティブになっている場合に例外を
    // 投げることがある(§7.1)。取得に失敗しても以降のジェスチャ処理は継続する
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      // ここで失敗しても pointermove/up は通常通りバブリングで届くため無視して問題ない
    }
    activePointers.set(e.pointerId, getPos(e));

    if (activePointers.size > 1) {
      startPinch();
      return;
    }
    if (state.viewer.scale) {
      startPhotoDrag(e);
      return;
    }
    startSwipe(e);
  }

  function movePinch(): void {
    const points = Array.from(activePointers.values());
    const dist = distance(
      points[0] as { x: number; y: number },
      points[1] as { x: number; y: number },
    );
    const size = (dist - oldDistance) / 100;
    const oldScaleSize = state.viewer.scaleSize;
    const posX = state.viewer.photoPosX;
    const posY = state.viewer.photoPosY;
    state.viewer.scaleSize += round(size, 6);
    if (state.viewer.scaleSize < 0.2) {
      state.viewer.scaleSize = 0.2;
    }
    if (state.viewer.scaleSize < oldScaleSize) {
      state.viewer.photoPosX =
        (1 + state.viewer.scaleSize - oldScaleSize) * posX;
      state.viewer.photoPosY =
        (1 + state.viewer.scaleSize - oldScaleSize) * posY;
    }
    const item = currentItem(state);
    if (item) {
      const border = borderOf(item);
      state.viewer.hideUi =
        state.viewer.scaleSize < 1 || state.viewer.scaleSize > border;
    }
    oldDistance = dist;
    callbacks.onGestureMove();
  }

  // oldPos/firstPos は swiping=true になる直前の startSwipe で必ず設定されるため、
  // ここに到達する時点で non-null が保証される
  function moveSwipe(e: PointerEvent): void {
    const pos = getPos(e);
    const x = pos.x - (oldPos as { x: number; y: number }).x;
    const y = pos.y - (firstPos as { x: number; y: number }).y;
    if (dragStart) {
      callbacks.onSwipeStart();
      dragStart = false;
      moveDir = Math.abs(x) > Math.abs(y) ? "horizontal" : "vertical";
    }
    if (moveDir === "horizontal") {
      state.viewer.translateX += x;
    } else {
      state.viewer.translateY = y;
    }
    oldPos = pos;
    callbacks.onSwipeMove();
  }

  // oldPhotoPos は photoSwipable=true になる直前の startPhotoDrag で必ず設定される
  function movePhotoDrag(e: PointerEvent): void {
    const pos = getPos(e);
    const x = pos.x - (oldPhotoPos as { x: number; y: number }).x;
    const y = pos.y - (oldPhotoPos as { x: number; y: number }).y;
    const moveX = round(state.viewer.scaleSize * x, 6);
    const moveY = round(state.viewer.scaleSize * y, 6);
    state.viewer.photoPosX += moveX;
    photoVX = moveX;
    state.viewer.photoPosY += moveY;
    photoVY = moveY;
    oldPhotoPos = pos;
    callbacks.onPhotoDragMove();
  }

  // pinching/photoSwipable のいずれでもなければ swiping であることが起動条件から保証される
  function onPointerMove(e: PointerEvent): void {
    if (!activePointers.has(e.pointerId)) {
      return;
    }
    activePointers.set(e.pointerId, getPos(e));

    if (pinching) {
      movePinch();
      return;
    }
    if (photoSwipable) {
      movePhotoDrag(e);
      return;
    }
    moveSwipe(e);
  }

  function endPinch(): void {
    pinching = false;
    const item = currentItem(state);
    if (!item) {
      return;
    }
    const border = borderOf(item);
    if (state.viewer.scaleSize > border) {
      return;
    }
    state.viewer.photoPosX = 0;
    state.viewer.photoPosY = 0;
    state.viewer.scale = false;
    state.viewer.scaleSize = 1;
    state.viewer.hideUi = false;
    callbacks.onGestureEnd();
  }

  // firstPos/oldPos は swiping=true になる直前の startSwipe で必ず設定される
  function endSwipe(): void {
    swiping = false;
    const first = firstPos as { x: number; y: number };
    const last = oldPos as { x: number; y: number };
    const now = Date.now();
    const offset = tapSecond - now;
    const swipeWidth = last.x - first.x;
    const swipeHeight = last.y - first.y;
    const noMove = swipeWidth === 0 && swipeHeight === 0;

    if (!isSmartPhone() && noMove) {
      callbacks.onTap();
      return;
    }
    if (Math.abs(offset) <= 500 && noMove) {
      callbacks.onTap();
      return;
    }
    tapSecond = now;

    const items = currentItems(state) ?? [];
    if (moveDir === "horizontal") {
      let result: "prev" | "next" | "stay" = "stay";
      if (
        swipeWidth >= state.options.swipeOffset &&
        state.viewer.currentIndex !== 0
      ) {
        result = "prev";
      } else if (
        swipeWidth <= -state.options.swipeOffset &&
        state.viewer.currentIndex !== items.length - 1
      ) {
        result = "next";
      }
      callbacks.onSwipeEnd(result);
    } else {
      // moveDir は startSwipe 後の最初の moveSwipe で必ず horizontal/vertical のいずれかに
      // 設定される(noMove の場合は上の tap 判定で既に return している)
      let result: "close-bottom" | "close-top" | "stay" = "stay";
      if (
        state.options.swipeBottomToClose &&
        swipeHeight >= state.options.swipeOffset
      ) {
        result = "close-bottom";
      } else if (
        state.options.swipeTopToClose &&
        swipeHeight <= -state.options.swipeOffset
      ) {
        result = "close-top";
      }
      callbacks.onSwipeEnd(result);
    }
  }

  // oldPhotoPos/firstPhotoPos は photoSwipable=true になる直前の startPhotoDrag で必ず設定される
  function endPhotoDrag(): void {
    photoSwipable = false;
    const oldPos_ = oldPhotoPos as { x: number; y: number };
    const firstPos_ = firstPhotoPos as { x: number; y: number };
    if (oldPos_.x === firstPos_.x) {
      callbacks.onPhotoDragEnd("zoom-out");
      return;
    }
    const item = currentItem(state);
    if (!item) {
      callbacks.onPhotoDragEnd(null);
      return;
    }
    const bound = boundOf(item);
    const offset = state.options.swipeOffset * state.viewer.scaleSize;
    let flagX = 0;
    let flagY = 0;
    if (state.viewer.photoPosX > bound.maxX) {
      flagX = -1;
    } else if (state.viewer.photoPosX < bound.minX) {
      flagX = 1;
    }
    if (state.viewer.photoPosY > bound.maxY) {
      flagY = -1;
    } else if (state.viewer.photoPosY < bound.minY) {
      flagY = 1;
    }

    if (
      state.viewer.photoPosX - bound.maxX > offset &&
      state.viewer.currentIndex !== 0
    ) {
      callbacks.onPhotoDragEnd("prev");
      return;
    }
    if (
      bound.minX - state.viewer.photoPosX > offset &&
      state.viewer.currentIndex + 1 !== state.viewer.total
    ) {
      callbacks.onPhotoDragEnd("next");
      return;
    }
    if (flagX === 0 && flagY === 0) {
      vx = photoVX / 5;
      vy = photoVY / 5;
    } else {
      registerElasticForce(flagX, flagY);
    }
    callbacks.onPhotoDragEnd(null);
  }

  function onPointerUp(e: PointerEvent): void {
    activePointers.delete(e.pointerId);

    if (pinching) {
      if (activePointers.size < 2) {
        endPinch();
      }
      return;
    }
    if (photoSwipable) {
      endPhotoDrag();
      return;
    }
    if (swiping) {
      endSwipe();
    }
  }

  // content(背景)と list(スライド/画像本体)は inner の下の兄弟要素であり、
  // どちらかがどちらかの子孫というわけではない(§6.2)。画像本体をタップ/スワイプ
  // した場合にも拾えるよう、両方に同じリスナーを束縛する必要がある。activePointers
  // 等の状態はこの関数の外側(createGestures)で共有しているため、複数要素に
  // バインドしても二重発火はしない(pointerId ごとに一度しか処理されない)
  function attach(...targets: Element[]): void {
    for (const target of targets) {
      target.addEventListener("pointerdown", onPointerDown as EventListener, {
        signal,
      });
      target.addEventListener("pointermove", onPointerMove as EventListener, {
        signal,
      });
      target.addEventListener("pointerup", onPointerUp as EventListener, {
        signal,
      });
      target.addEventListener("pointercancel", onPointerUp as EventListener, {
        signal,
      });
    }
  }

  function detach(): void {
    clearInterval(interval);
  }

  return { attach, detach };
}
