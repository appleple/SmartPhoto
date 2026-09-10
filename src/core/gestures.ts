import * as util from "../lib/util";
import { currentItem, currentItems, makeBound, scaleBorder } from "./state";
import type { GestureCallbacks, Item, State } from "./types";

function round(val: number, precision: number): number {
  const digit = 10 ** precision;
  return Math.round(val * digit) / digit;
}

// pageX/pageY(ページ座標)ではなく clientX/clientY(ビューポート座標)を使う。
// スワイプ量・ピンチ距離などの「差分」はどちらでも同じだが、中点基準ズーム
// (movePinch)は画像中心(ビューポート座標)との「絶対位置」比較のため、
// ページ座標だとスクロール量が上乗せされ、スクロールした状態で開いて
// ピンチすると画像がスクロール量ぶん大きくずれてしまう
function getPos(e: PointerEvent): { x: number; y: number } {
  return { x: e.clientX, y: e.clientY };
}

function distance(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): number {
  const x = p1.x - p2.x;
  const y = p1.y - p2.y;
  return Math.sqrt(x * x + y * y);
}

// トラックパッドの慎重な操作はポインタ加速度の影響で移動距離が伸びにくく、
// swipeOffset(絶対距離)だけでは「最後までドラッグしないと切り替わらない」と
// 感じさせてしまう(§V1由来の既知の使いづらさ)。距離が短くても素早い操作
// (フリック)なら切り替えを許可するための最小移動距離。
const MIN_FLICK_DISTANCE = 10;

function getForceAndTheta(
  x: number,
  y: number,
): { force: number; theta: number } {
  return { force: Math.sqrt(x * x + y * y), theta: Math.atan2(y, x) };
}

// ファサード側(zoomPhoto 等)の getWindowHeight と同じ基準(visualViewport 優先)で
// 計測する。基準が食い違うと、iOS のアドレスバー表示/非表示で clientHeight と実
// ビューポートが乖離した際、タップズームとピンチ終了で「ズームを維持できる倍率」や
// ドラッグ可動域(makeBound)がズレる
function windowSize(): { width: number; height: number } {
  return {
    width: util.getWindowWidth(),
    height: util.getWindowHeight(),
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
  let swipeStartTime = 0;
  let tapTarget: EventTarget | null = null;

  let photoSwipable = false;
  let firstPhotoPos: { x: number; y: number } | null = null;
  let oldPhotoPos: { x: number; y: number } | null = null;
  let photoVX = 0;
  let photoVY = 0;

  let pinching = false;
  // ピンチ開始時(または指の組が変わった時)の2本指の距離と倍率。
  // 倍率は「開始倍率 × 現距離/開始距離」の比率で追従させる(§movePinch)
  let pinchStartDistance = 0;
  let pinchStartScale = 1;
  let pinchMoveFrame: number | null = null;

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

  // ピンチの「戻る先」となる基準倍率。resizeStyle:'fill'(スマホ)は開いた時点で
  // fill 倍率(scaleBorder)まで拡大して表示しているため、そこが基準になる
  function baselineOf(item: Item): number {
    return state.options.resizeStyle === "fill" && isSmartPhone()
      ? borderOf(item)
      : 1;
  }

  // ピンチで維持できる上限倍率。PhotoSwipe の maxZoomLevel 既定(fit の4倍)に
  // 合わせる。タップズーム/fill の倍率(scaleBorder)がそれを超える環境では、
  // タップで到達できる倍率をピンチで取り消さないようそちらを上限にする
  const MAX_PINCH_SCALE = 4;
  function maxScaleOf(item: Item): number {
    return Math.max(MAX_PINCH_SCALE, borderOf(item));
  }

  // 基準倍率のこの割合より小さく縮めて離したら「閉じたい操作」とみなす
  // (PhotoSwipe の pinchToClose 相当。僅かな縮小は基準へのスプリングバックに留める)
  const PINCH_CLOSE_RATIO = 0.75;

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
    // 勢いが抵抗を下回ったら停止する。旧実装(Math.abs(force) < 0.5)は
    // force が -0.5 ちょうどのとき(勢いゼロで抵抗だけが残る静止状態)に
    // 判定をすり抜け、負の力で逆方向へ僅かにドリフトし続けていた
    if (force < 0.5) {
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

  // ピンチの基準(開始距離・開始倍率)を現在の指の位置から取り直す。
  // 開始時のほか、3本→2本のように指の組が変わった時にも呼ぶ。
  // 取り直さないと、別の2点間の距離に対する比率計算になって倍率が不連続に跳ぶ
  function rebasePinch(): void {
    const points = Array.from(activePointers.values());
    pinchStartDistance = distance(
      points[0] as { x: number; y: number },
      points[1] as { x: number; y: number },
    );
    pinchStartScale = state.viewer.scaleSize;
  }

  function startPinch(): void {
    pinching = true;
    swiping = false;
    photoSwipable = false;
    rebasePinch();
    // 直前のドラッグの慣性(vx/vy)が残っていると、ピンチ終了後に慣性ループが
    // その勢いで写真を流してしまうため、ピンチ開始で必ず打ち切る
    vx = 0;
    vy = 0;
    state.viewer.scale = true;
    // ピンチ操作の間は矢印/ナビを隠す。表示に戻すかどうかは endPinch が
    // 離した時点の倍率(基準へ戻る/ズーム維持)に応じて確定する
    state.viewer.hideUi = true;
    callbacks.onGestureStart();
  }

  function startSwipe(e: PointerEvent): void {
    const pos = getPos(e);
    swiping = true;
    dragStart = true;
    firstPos = pos;
    oldPos = pos;
    swipeStartTime = Date.now();
    // onPointerDown の setPointerCapture 以降、pointerup はキャプチャ要素
    // (content/list)へ再ターゲットされるため、タップが実際にどの要素に
    // ヒットしたか(写真の上か背景か)は pointerdown の時点でしか分からない
    tapTarget = e.target;
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

  // PCトラックパッドの2本指ピンチは合成pointermoveの発火頻度が実タッチより高く不規則な
  // ことがあり、毎イベント同期でDOM更新するとフレーム内で複数回のstyle再計算が発生して
  // カクつく。state更新は毎イベント同期のまま行い、DOMに触れるコールバックだけを1フレームに
  // 1回へ間引く。
  function scheduleGestureMove(): void {
    if (pinchMoveFrame !== null) {
      return;
    }
    pinchMoveFrame = requestAnimationFrame(() => {
      pinchMoveFrame = null;
      callbacks.onGestureMove();
    });
  }

  // 保留中のフレームを単に cancel すると、指を離した瞬間の最終フレーム分の
  // DOM更新(img.style.transform)が失われ、内部stateは最終値なのに見た目だけ
  // 1フレーム前のまま固定される(ズームで下部に隙間が見える不整合の原因になる)。
  // cancel した分は同期的に onGestureMove を呼んで必ず反映してから終える。
  function flushGestureMove(): void {
    if (pinchMoveFrame === null) {
      return;
    }
    cancelAnimationFrame(pinchMoveFrame);
    pinchMoveFrame = null;
    callbacks.onGestureMove();
  }

  function movePinch(): void {
    const points = Array.from(activePointers.values());
    const p0 = points[0] as { x: number; y: number };
    const p1 = points[1] as { x: number; y: number };
    const dist = distance(p0, p1);
    // 2本の指が同一座標で始まった場合は比率を計算できない(0除算)。
    // 距離が付いた時点を開始基準にして以降の move から追従させる
    if (pinchStartDistance === 0) {
      pinchStartDistance = dist;
      pinchStartScale = state.viewer.scaleSize;
      scheduleGestureMove();
      return;
    }
    const oldScaleSize = state.viewer.scaleSize;
    // 業界標準(PhotoSwipe / iOS 写真)の「開始倍率 × 現距離/開始距離」。
    // 距離の差分で線形に動かす方式(旧: ±dist/100)は、高倍率から戻す
    // ピンチインで一気に閉じる閾値まで突き抜けてしまう
    state.viewer.scaleSize = round(
      (pinchStartScale * dist) / pinchStartDistance,
      6,
    );
    if (state.viewer.scaleSize < 0.2) {
      state.viewer.scaleSize = 0.2;
    }
    // 業界標準(PhotoSwipe / iOS 写真)に合わせ、ピンチの中点を基準に拡大縮小する。
    // 中点直下の絵柄が拡大後も中点に残るよう、倍率変化(ratio)に応じて
    // 画像中心の位置(photoPos)を補正する。旧実装は常に画像中心基準だったため、
    // 見たい場所をピンチしても中心が拡大されるだけだった
    const item = currentItem(state);
    if (item && state.viewer.scaleSize !== oldScaleSize) {
      const { width: winW, height: winH } = windowSize();
      // フィット配置での画像中心(sizeItems の item.x/y と同じ基準)
      const cx = winW / 2;
      const cy =
        state.options.headerHeight +
        (winH - state.options.headerHeight - state.options.footerHeight) / 2;
      // photoPos → 画面px の換算係数(§state.ts makeBound)
      const k = item.scale;
      const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      const ratio = state.viewer.scaleSize / oldScaleSize;
      const dx = mid.x - (cx + state.viewer.photoPosX * k);
      const dy = mid.y - (cy + state.viewer.photoPosY * k);
      state.viewer.photoPosX = round((mid.x - dx * ratio - cx) / k, 6);
      state.viewer.photoPosY = round((mid.y - dy * ratio - cy) / k, 6);
    }
    scheduleGestureMove();
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

  // 業界標準(PhotoSwipe / iOS 写真)の離し挙動:
  // - 基準倍率(fit / fill)未満: 基準へスプリングバック。はっきり小さく
  //   縮めた場合(基準の3/4未満)は「閉じたい操作」として閉じる(pinchToClose)
  // - 基準以上・上限以下: その倍率を維持する(勝手に戻さない)
  // - 上限(fit の4倍)超: 上限へスプリングバック
  // 旧実装は「fill 倍率以下はすべてフィットへ戻す」だったため、中途半端に
  // 拡大したズームが離すたびに取り消されていた
  function endPinch(): void {
    pinching = false;
    flushGestureMove();
    const item = currentItem(state);
    if (!item) {
      return;
    }
    const base = baselineOf(item);
    if (state.viewer.scaleSize <= base) {
      if (
        state.options.pinchToClose &&
        state.viewer.scaleSize < base * PINCH_CLOSE_RATIO
      ) {
        callbacks.onPinchClose();
        return;
      }
      state.viewer.photoPosX = 0;
      state.viewer.photoPosY = 0;
      state.viewer.scaleSize = base;
      // fill の基準はズーム表示そのもの(開いた時点と同じ状態)なので
      // scale/hideUi は維持する。fit(base=1)は通常表示へ完全に戻す
      state.viewer.scale = base > 1;
      state.viewer.hideUi = base > 1;
      callbacks.onGestureEnd();
      return;
    }
    state.viewer.scaleSize = Math.min(state.viewer.scaleSize, maxScaleOf(item));
    // ズームを維持して離した場合も、倍率変化で狭まった可動域の外に
    // パン位置が残っていれば弾性で収める(endPhotoDrag と同じ扱い)
    const bound = boundOf(item);
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
    if (flagX !== 0 || flagY !== 0) {
      registerElasticForce(flagX, flagY);
    }
    state.viewer.scale = true;
    state.viewer.hideUi = true;
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
      callbacks.onTap(tapTarget);
      return;
    }
    if (Math.abs(offset) <= 500 && noMove) {
      callbacks.onTap(tapTarget);
      return;
    }
    tapSecond = now;

    const items = currentItems(state) ?? [];
    if (moveDir === "horizontal") {
      let result: "prev" | "next" | "stay" = "stay";
      // トラックパッド操作は移動距離が伸びにくいため、swipeOffset未満でも
      // 素早いフリック(速度がswipeVelocityを超える)なら切り替えを許可する
      const elapsedMs = Math.max(now - swipeStartTime, 1);
      const isFlick =
        Math.abs(swipeWidth) >= MIN_FLICK_DISTANCE &&
        Math.abs(swipeWidth) / elapsedMs >= state.options.swipeVelocity;
      if (
        (swipeWidth >= state.options.swipeOffset ||
          (isFlick && swipeWidth > 0)) &&
        state.viewer.currentIndex !== 0
      ) {
        result = "prev";
      } else if (
        (swipeWidth <= -state.options.swipeOffset ||
          (isFlick && swipeWidth < 0)) &&
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
    // 「ズーム中のタップ = ズーム解除」の判定。x だけの比較だと、まっすぐ縦に
    // パンした(x が変わらない)だけでズームが全解除され、見ていた場所から
    // fit 表示まで一気に戻ってしまうため、x/y 両方の無移動をタップとみなす
    if (oldPos_.x === firstPos_.x && oldPos_.y === firstPos_.y) {
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
        // 残った1本の指は次の pointerdown まで追跡しない。スワイプや
        // タップ(=zoom-out)として引き継ぐと、ピンチ直後の指の動きで
        // リストが送られたりズームが解除されたりする誤動作になる
        activePointers.clear();
      } else {
        // 3本→2本のように指の組が変わった場合は基準を取り直す(§rebasePinch)
        rebasePinch();
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
    if (pinchMoveFrame !== null) {
      cancelAnimationFrame(pinchMoveFrame);
      pinchMoveFrame = null;
    }
  }

  return { attach, detach };
}
