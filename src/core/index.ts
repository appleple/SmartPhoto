import * as util from "../lib/util";
import type { Gestures } from "./gestures";
import { createGestures } from "./gestures";
import {
  addItemToGroup,
  buildHash,
  createState,
  currentItem,
  currentItems,
  findItemByHash,
  groupIdFromElement,
  groupIdFromSlide,
  itemFromElement,
  itemFromSlide,
  resetTranslate,
  scaleBorder,
  setArrow,
  sizeItems,
} from "./state";
import type {
  AppearEffect,
  GestureCallbacks,
  Item,
  ItemId,
  SlideData,
  SmartPhotoEvent,
  SmartPhotoItem,
  SmartPhotoOptions,
  SmartPhotoSource,
  State,
} from "./types";
import type { View, ViewHandlers } from "./view";
import { createView } from "./view";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

interface ShowOptions {
  group?: string;
  trigger?: HTMLElement;
}

// ジェスチャー側の境界計算(gestures.ts の windowSize)と同じ基準で計測するため
// util に集約している(visualViewport 優先の理由も util.getWindowHeight 参照)
const getWindowWidth = util.getWindowWidth;
const getWindowHeight = util.getWindowHeight;

// $().get() や Array.from(NodeList) 等で渡される「DOM要素の配列」は Array.isArray()
// では SlideData[] と区別できない。先頭要素が Element かどうかで実データを見て判別する
function isElementArray(source: unknown[]): source is Element[] {
  return source.length > 0 && source[0] instanceof Element;
}

function getUniqId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).substring(2, 7)
  ).toUpperCase();
}

// documentElement は getWindowWidth/Height と同様に常に存在する前提を置く
function getScroll(): { x: number; y: number } {
  return {
    x:
      window.pageXOffset !== undefined
        ? window.pageXOffset
        : document.documentElement.scrollLeft,
    y:
      window.pageYOffset !== undefined
        ? window.pageYOffset
        : document.documentElement.scrollTop,
  };
}

// SmartPhoto v2 ファサード。公開API(README §2 の既存契約 + §3 の新API)を実装し、
// state / view / gestures を結線する。データソースの違い(HTML / 配列)は
// ingestSource() が入口で吸収し、以降のロジックは Item だけを見る(§3.5)
export default class SmartPhoto {
  private readonly id = getUniqId();
  private readonly abortController = new AbortController();
  private readonly state: State;
  private readonly view: View;
  private readonly gestures: Gestures;
  private readonly isSmartPhoneFlag = util.isSmartPhone();
  private lastTriggerElement: HTMLElement | null = null;
  // fireEvent("close") が dialog に発火する公開イベントは、ネイティブの close
  // イベントと同じ "close" という型名を共有する(§8)。閉じるアニメーション完了後に
  // 遅延発火するこの公開イベントを、ネイティブ close 同期用リスナー(下記)が
  // 誤って拾わないよう、発火中であることを示すフラグで区別する
  private isFiringPublicCloseEvent = false;
  // doHideEffect() の後始末(画像に設定した translateY の除去と promise 解決)を
  // transitionend を待たずに即時実行するための関数。後始末が済むと null に戻る
  private finishHideEffect: (() => void) | null = null;
  // 開く View Transition が進行中かどうか。進行中にリサイズ由来の再計算(commit)が
  // 走ると、モーフの目標位置は古いビューポート基準のままなのに実要素だけ新しい
  // 位置へ動いて「一旦ずれた位置に出てから正位置へ戻る」ように見え、さらに
  // モーフ用レイアウト(applyViewTransitionLayout)も巻き戻されてしまう。
  // そのため進行中はリサイズ再計算を保留し、finished 後にまとめて実行する
  private isViewTransitionActive = false;
  private pendingViewTransitionResync = false;
  private timeouts: number[] = [];
  private loadAllFired = new Set<string>();
  private syncedGroupId: string | null = null;
  // 文字列セレクタで構築された場合のみ設定される。Ajax等で後から追加された
  // 要素をクリック時に動的検出するための再スキャン起点(§discoverGroupElements)
  private rootSelector: string | null = null;
  // クリックされた要素(またはその祖先)から登録済み Item を逆引きするための
  // キャッシュ。documentへのイベントデリゲーションで祖先チェーンを辿る際に使う
  private readonly itemsByElement = new Map<Element, Item>();

  constructor(source: SmartPhotoSource, settings?: SmartPhotoOptions) {
    this.rootSelector = typeof source === "string" ? source : null;
    this.state = createState(settings ?? {});
    this.view = createView(
      { id: this.id, options: this.state.options },
      this.buildViewHandlers(),
      { signal: this.abortController.signal },
    );
    document.body.appendChild(this.view.root);
    this.gestures = createGestures(
      { state: this.state, callbacks: this.buildGestureCallbacks() },
      { signal: this.abortController.signal },
    );
    // content(背景)と list(画像本体)は兄弟要素のため、画像自体をタップ/スワイプ
    // した場合にも拾えるよう両方に束縛する(§)
    this.gestures.attach(this.view.refs.content, this.view.refs.list);

    // hidePhoto() は公開イベントとして独自の "close" CustomEvent もこの同じ
    // dialog 要素に発火する(isFiringPublicCloseEvent 参照)。ネイティブの close
    // イベント(ESC 等、hidePhoto() を経由しない close())との同期用リスナーが
    // それを誤って拾わないようにする。特に「閉じた直後に別の画像を素早く開く」操作
    // では、閉じるアニメーション完了後に遅延発火する公開 "close" イベントが、既に
    // 再オープンした状態(isOpen=true)に対して hidePhoto() を誤って呼び出し、
    // 開いたばかりのモーダルを閉じてしまう不具合があった
    this.view.refs.dialog.addEventListener(
      "close",
      () => {
        if (!this.isFiringPublicCloseEvent && this.state.viewer.isOpen) {
          this.hidePhoto();
        }
      },
      { signal: this.abortController.signal },
    );

    // サムネイルのクリックは個別バインドではなく document への1本のデリゲーション
    // リスナーで受ける(§handleDocumentClick)。これにより、文字列セレクタで構築
    // した場合は初期化後にAjax等で追加された要素もクリック時に自動検出できる
    document.addEventListener("click", this.handleDocumentClick, {
      signal: this.abortController.signal,
    });

    this.ingestSource(source);
    this.syncCurrentGroupView();

    const restored = this.restoreFromHash();
    if (restored) {
      // 個別バインドを廃止した(document委任のみ)ため、クリックの疑似発火では
      // 届かない(util.triggerEvent は bubbles: false)。openPhoto() を直接呼ぶ
      this.openPhoto(restored, restored.element);
    }

    // 100dvh は iOS Safari 等でアドレスバーの表示/非表示に伴うリサイズへの追従が
    // 実装依存で不安定(§css)なため、実測した高さを --smartphoto-vh として明示的に
    // 設定し、dialog の height/中央寄せ計算をそちらに合わせるフォールバックにする。
    // visualViewport は URL バーの伸縮も resize として発火するため、対応環境では
    // window の resize より優先する(スマートフォンで window.resize を購読しない
    // 既存方針(下記)とは独立した、この変数専用の軽量な購読)
    this.updateViewportHeight();
    this.applyAutoIconContrast();
    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        this.handleVisualViewportResize,
        { signal: this.abortController.signal },
      );
    } else {
      window.addEventListener("resize", this.updateViewportHeight, {
        signal: this.abortController.signal,
      });
    }

    if (!this.isSmartPhoneFlag) {
      window.addEventListener("resize", this.handleResize, {
        signal: this.abortController.signal,
      });
      window.addEventListener("keydown", this.handleKeydown, {
        signal: this.abortController.signal,
      });
      return;
    }

    window.addEventListener("orientationchange", this.handleOrientationChange, {
      signal: this.abortController.signal,
    });
  }

  // ---- 公開 API: 既存契約 ----

  on(
    event: SmartPhotoEvent,
    fn: (this: HTMLDialogElement, ev: Event) => void,
  ): void {
    const dialog = this.view.refs.dialog;
    const handler = (e: Event) => fn.call(dialog, e);
    dialog.addEventListener(event, handler, {
      signal: this.abortController.signal,
    });
  }

  destroy(): void {
    // dialog.close() が発火するネイティブ close イベントがこの後もまだ有効な
    // リスナー(abort はこの後)経由で hidePhoto() を呼んでしまわないよう、
    // 先に isOpen を落としておく
    this.state.viewer.isOpen = false;
    if (this.view.refs.dialog.open) {
      this.view.refs.dialog.close();
    }
    this.abortController.abort();
    this.timeouts.forEach((id) => {
      clearTimeout(id);
    });
    this.timeouts = [];
    this.itemsByElement.clear();
    this.gestures.detach();
    this.view.destroy();
  }

  // using宣言でスコープを離脱した際に destroy() を自動実行できるようにする
  [Symbol.dispose](): void {
    this.destroy();
  }

  gotoSlide(index: number): void {
    const parsed = Number.parseInt(String(index), 10);
    const next = Number.isNaN(parsed) ? 0 : parsed;
    // viewer.prev/next は端(最初/最後)のスライドでは setArrow() が更新せず -1 の
    // ままのことがあり、送り操作の直後(setArrow 反映前の 200ms 以内)に逆方向へ
    // 送るとその -1 がここへ渡り得る。currentIndex を範囲外にすると currentItem
    // が見つからず以降の送り・描画が壊れたままになるため、「送り先なし」として
    // 何もしない
    const total = currentItems(this.state)?.length ?? 0;
    if (next < 0 || next >= total) {
      return;
    }
    this.state.viewer.currentIndex = next;
    this.slideList();
  }

  hidePhoto(dir: "top" | "bottom" = "bottom"): void {
    if (!this.state.viewer.isOpen) {
      return;
    }
    this.state.viewer.isOpen = false;
    this.state.viewer.appear = false;
    this.state.viewer.appearEffect = null;
    this.view.removeAppearEffect();
    this.state.viewer.hideUi = false;
    this.state.viewer.scale = false;
    this.state.viewer.scaleSize = 1;

    const scroll = getScroll();
    if (location.hash) {
      this.setHash("");
    }
    window.scroll(scroll.x, scroll.y);

    this.syncDialog();

    if (this.lastTriggerElement?.isConnected) {
      this.lastTriggerElement.focus();
    }
    this.lastTriggerElement = null;

    this.doHideEffect(dir).then(() => {
      this.view.render(this.state);
      this.isFiringPublicCloseEvent = true;
      this.fireEvent("close");
      this.isFiringPublicCloseEvent = false;
    });
  }

  zoomPhoto(): void {
    const item = currentItem(this.state);
    if (!item) {
      return;
    }
    this.state.viewer.hideUi = true;
    this.state.viewer.scaleSize = scaleBorder(
      item,
      getWindowWidth(),
      getWindowHeight(),
      this.isSmartPhoneFlag,
    );
    if (this.state.viewer.scaleSize <= 1) {
      return;
    }
    this.state.viewer.photoPosX = 0;
    this.state.viewer.photoPosY = 0;
    this.view.updatePhotoTransform(this.state);
    this.scheduleTimeout(() => {
      // isOpen のガードがないと、ズーム操作直後に閉じた場合、この遅延処理が
      // 閉じるアニメーション中に実行され、doHideEffect() が設定した
      // 閉じるスライド(translateY)を上書きしてしまう
      if (!this.state.viewer.isOpen) {
        return;
      }
      this.state.viewer.scale = true;
      this.view.updatePhotoTransform(this.state);
      this.fireEvent("zoomin");
      // 待ち時間が transition より短い固定値(旧: 300ms)だと、scale=true が付ける
      // smartphoto-img-onmove(transition: none)が進行中のズームアニメーションを
      // 途中で打ち切り、最終倍率へスナップして「拡大時のカクつき」になる。
      // scale 状態への移行は必ずアニメーション完了後に行う
    }, this.state.options.animationSpeed);
  }

  // zoomPhoto() と同じ「ズームの余地があるか」の判定(scaleBorder <= 1 なら
  // ズームしても見た目が変わらない)。zoomPhoto() 自体は公開 API の契約
  // (ズームできなければ何もしない)を保つ必要があるため、タップの
  // zoom-or-close 分岐(§7)用に判定だけを切り出している
  private canZoomCurrentPhoto(): boolean {
    const item = currentItem(this.state);
    return (
      !!item &&
      scaleBorder(
        item,
        getWindowWidth(),
        getWindowHeight(),
        this.isSmartPhoneFlag,
      ) > 1
    );
  }

  zoomOutPhoto(): void {
    this.state.viewer.scaleSize = 1;
    this.state.viewer.hideUi = false;
    this.state.viewer.scale = false;
    this.state.viewer.photoPosX = 0;
    this.state.viewer.photoPosY = 0;
    this.view.updatePhotoTransform(this.state);
    this.fireEvent("zoomout");
  }

  addNewItem(element: HTMLElement): SmartPhotoItem {
    return this.addItem(element);
  }

  // ---- 公開 API: v2 新設(§3.3) ----

  show(indexOrId: ItemId = 0, opts: ShowOptions = {}): void {
    const groupId = opts.group ?? this.state.viewer.currentGroup;
    if (groupId === null) {
      return;
    }
    const items = this.state.groups.get(groupId);
    if (!items?.length) {
      return;
    }
    const item =
      typeof indexOrId === "number"
        ? items[indexOrId]
        : items.find((i) => i.id === indexOrId);
    if (!item) {
      return;
    }
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const trigger = opts.trigger ?? item.element ?? activeElement;
    this.openPhoto(item, trigger);
  }

  hide(): void {
    this.hidePhoto();
  }

  next(): void {
    if (!this.state.viewer.showNextArrow) {
      return;
    }
    this.gotoSlide(this.state.viewer.next);
  }

  prev(): void {
    if (!this.state.viewer.showPrevArrow) {
      return;
    }
    this.gotoSlide(this.state.viewer.prev);
  }

  addItem(slideOrElement: SlideData | HTMLElement): SmartPhotoItem {
    const item =
      slideOrElement instanceof HTMLElement
        ? this.addElementItem(slideOrElement)
        : this.addSlideItem(slideOrElement);
    this.syncCurrentGroupView();
    return item;
  }

  get currentIndex(): number {
    return this.state.viewer.currentIndex;
  }

  // ---- 内部: ソース取り込み ----

  private ingestSource(source: SmartPhotoSource): void {
    if (Array.isArray(source) && !isElementArray(source)) {
      source.forEach((slide) => {
        this.addSlideItem(slide);
      });
      return;
    }
    const elements =
      typeof source === "string"
        ? Array.from(document.querySelectorAll(source))
        : Array.from(source as NodeListOf<Element> | Element[]);
    elements.forEach((el) => {
      this.addElementItem(el as HTMLElement);
    });
  }

  private addElementItem(element: HTMLElement): Item {
    const groupId = groupIdFromElement(element);
    const index = this.state.groups.get(groupId)?.length ?? 0;
    const item = itemFromElement(
      element,
      this.state.options,
      index,
      getWindowWidth(),
    );
    addItemToGroup(this.state, item);
    this.loadAllFired.delete(groupId);
    this.itemsByElement.set(element, item);
    return item;
  }

  private addSlideItem(slide: SlideData): Item {
    const groupId = groupIdFromSlide(slide);
    const index = this.state.groups.get(groupId)?.length ?? 0;
    const item = itemFromSlide(slide, index, getWindowWidth());
    addItemToGroup(this.state, item);
    this.loadAllFired.delete(groupId);
    return item;
  }

  // クリックされた要素(またはその祖先。<a><img></a> の img がクリックされる
  // ケースを含む)から、登録済み Item を持つ要素まで祖先チェーンを遡って探す
  private findRegisteredAncestor(target: Element): Element | null {
    let node: Element | null = target;
    while (node) {
      if (this.itemsByElement.has(node)) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  // rootSelector(文字列セレクタで構築した場合のみ設定される)を再スキャンし、
  // 指定グループを現在のDOM状態に合わせて丸ごと再構築する(追加・削除・並び順の
  // 変化を一度に反映)。既知要素は既存の Item オブジェクトをそのまま再利用する
  // ため loaded/width/height は保持され、DOM から消えた要素だけ itemsByElement
  // からも除去する。index/translateX は resetTranslate() で再計算する。
  // 呼び出し元(openPhoto)がこの結果を使い、変化があった場合のみ view を
  // 再同期する(§ダイアログを開く瞬間に整合を取る。開いている間の next()/prev()
  // では呼ばれないため、この間の追加/削除は次に開き直すまで反映されない)
  private resyncGroupFromDom(groupId: string): boolean {
    if (!this.rootSelector) {
      return false;
    }
    const domElements = Array.from(
      document.querySelectorAll(this.rootSelector),
    ).filter((el) => groupIdFromElement(el) === groupId) as HTMLElement[];
    const domElementSet = new Set<HTMLElement>(domElements);

    const previous = this.state.groups.get(groupId) ?? [];
    const previousByElement = new Map<HTMLElement, Item>();
    previous.forEach((it) => {
      if (it.element) {
        previousByElement.set(it.element, it);
      }
    });

    let changed = domElements.length !== previous.length;
    const rebuilt = domElements.map((el, index) => {
      const existing = previousByElement.get(el);
      if (existing) {
        if (existing.index !== index) {
          changed = true;
          existing.index = index;
        }
        return existing;
      }
      changed = true;
      const item = itemFromElement(
        el,
        this.state.options,
        index,
        getWindowWidth(),
      );
      this.itemsByElement.set(el, item);
      return item;
    });

    previous.forEach((it) => {
      if (it.element && !domElementSet.has(it.element)) {
        this.itemsByElement.delete(it.element);
      }
    });

    resetTranslate(rebuilt, getWindowWidth());
    this.state.groups.set(groupId, rebuilt);
    if (changed) {
      this.loadAllFired.delete(groupId);
    }
    return changed;
  }

  // サムネイルクリックはこの1本の document デリゲーションリスナーだけで処理する
  // (個別バインドは廃止)。同じクリックイベントを複数の SmartPhoto インスタンスが
  // 二重処理しないよう、処理済みマーカーをイベント自体に立てて後続インスタンスに
  // 早期returnさせる(セレクタが重複するインスタンスが同時に存在するケース)
  private handleDocumentClick = (e: MouseEvent): void => {
    if (!(e.target instanceof Element)) {
      return;
    }
    const marker = e as MouseEvent & { __smartphotoClaimed?: boolean };
    if (marker.__smartphotoClaimed) {
      return;
    }

    let matched = this.findRegisteredAncestor(e.target);
    if (!matched && this.rootSelector) {
      matched = e.target.closest(this.rootSelector);
    }
    if (!matched) {
      return;
    }

    e.preventDefault();
    marker.__smartphotoClaimed = true;

    // 未登録の新規要素の場合、openPhoto() へ渡す Item を得るためにここで先に
    // グループを解決する。openPhoto() 内でも resyncGroupFromDom() が走るが、
    // その時点ではもう解決済みで「変化なし」と判定されてしまうため、view の
    // 再同期(syncCurrentGroupView)はこの呼び出し側で行う必要がある
    if (!this.itemsByElement.has(matched) && this.rootSelector) {
      const groupId = groupIdFromElement(matched);
      if (this.resyncGroupFromDom(groupId)) {
        this.syncCurrentGroupView();
      }
    }

    const item = this.itemsByElement.get(matched);
    if (item) {
      this.openPhoto(item, matched as HTMLElement);
    }
  };

  private syncCurrentGroupView(): void {
    const items = currentItems(this.state);
    if (items) {
      this.view.syncSlides(items, this.state);
      this.syncedGroupId = this.state.viewer.currentGroup;
    }
  }

  // ---- 内部: ハッシュ ----

  private setHash(hash: string): void {
    if (!window.history?.pushState || !this.state.options.useHistoryApi) {
      return;
    }
    const path = `${location.pathname}${location.search}`;
    window.history.replaceState(null, "", hash ? `${path}#${hash}` : path);
  }

  private setHashByCurrentIndex(): void {
    const scroll = getScroll();
    this.setHash(buildHash(this.state));
    window.scroll(scroll.x, scroll.y);
  }

  private restoreFromHash(): Item | null {
    const hash = location.hash.substring(1);
    if (!hash) {
      return null;
    }
    return findItemByHash(this.state, util.parseQuery(hash));
  }

  // ---- 内部: レイアウト ----

  private setPosByCurrentIndex(): void {
    const item = currentItem(this.state);
    if (!item) {
      return;
    }
    this.state.viewer.translateX = -item.translateX;
    this.state.viewer.translateY = 0;
    this.view.updateListTransform(this.state);
  }

  private setSizeByScreen(): void {
    const items = currentItems(this.state);
    if (!items) {
      return;
    }
    sizeItems(
      items,
      getWindowWidth(),
      getWindowHeight(),
      this.state.options.headerHeight,
      this.state.options.footerHeight,
    );
    // fill の拡大率(viewer.scaleSize)はここで再計算した item.scale に依存する。
    // 再計算箇所ごとに個別へ呼ばせると漏れる(スライド送り・orientationchange・
    // visualViewport リサイズで漏れており、送った先が fit サイズのまま表示され
    // 後から fill へ跳ねる不具合があった)ため、ここで必ず同期する
    this.syncFillScale();
  }

  // resize/orientationchange ハンドラは呼び出し前に currentItems の存在を確認済み
  private resetTranslateCurrent(): void {
    resetTranslate(currentItems(this.state) as Item[], getWindowWidth());
  }

  private currentImgElement(): HTMLImageElement | null {
    for (const [item, slideRefs] of this.view.refs.slides) {
      if (item.index === this.state.viewer.currentIndex) {
        return slideRefs.img;
      }
    }
    return null;
  }

  private currentLiElement(): HTMLLIElement | null {
    for (const [item, slideRefs] of this.view.refs.slides) {
      if (item.index === this.state.viewer.currentIndex) {
        return slideRefs.li;
      }
    }
    return null;
  }

  // ---- 内部: dialog 制御(§8) ----

  private syncDialog(): void {
    const { dialog, caption } = this.view.refs;
    // dialog 自体の opacity/display フェード(§8のCSS transition)は showAnimation
    // を関知しない stylesheet 側の指定のため、false のときは JS 側で明示的に
    // transition を止めないと open/close どちらでもアニメーションしてしまう
    dialog.style.transition =
      this.state.options.showAnimation === false ? "none" : "";
    if (this.state.viewer.isOpen && !dialog.open) {
      // ホスト側 CSS の `dialog { display: block; }` 系ルールが
      // dialog:not([open]) の display:none を上書きしてしまっているケースの保険
      // として、閉じている間だけ style.display を直接 "none" にしている(下記)。
      // 開く際はそれを取り除き、ネイティブの表示制御に戻す
      dialog.style.removeProperty("display");
      dialog.showModal();
      caption.focus();
    } else if (!this.state.viewer.isOpen && dialog.open) {
      dialog.close();
      dialog.style.display = "none";
    }
  }

  private commit(): void {
    this.view.render(this.state);
    // render() は imgWrap 側(item.scale による fit 配置)しか更新しない。写真本体
    // (img)の translate/scale は updatePhotoTransform() 側の専任だったため、
    // 元々ズーム操作(zoomPhoto/gesture)経由でしか呼ばれておらず、resizeStyle:
    // 'fill' で initPhoto() が設定した viewer.scaleSize が open 直後には一度も
    // DOM へ反映されない(ズーム操作で初めて反映される)不具合があった。commit()
    // を「状態を DOM へ完全に同期する」唯一の入口にし、ここに含める
    this.view.updatePhotoTransform(this.state);
    this.syncDialog();
  }

  // ---- 内部: 開く演出 ----

  // initPhoto() は必ず有効なアイテムが存在するグループを開いた直後に呼ばれる
  // (doOpen/loadNeighborItems/slideList のいずれも呼び出し前に確認済み)
  private initPhoto(): void {
    // 直前の hidePhoto() のフェードアウトが transitionend 前に中断された場合に備え、
    // doHideEffect() の後始末(画像の translateY 除去など)を開く前に必ず完了させる
    this.finishHideEffect?.();
    // --smartphoto-vh はコンストラクタ時点と resize/orientationchange でのみ更新され、
    // 「開く」タイミングでは再計算していなかった。構築後にページスクロール等で
    // アドレスバーが引っ込み実ビューポートが広がった状態で開くと、dialog の高さ
    // (height: var(--smartphoto-vh)) が実際より小さいまま残り、下側の隙間から
    // 背景ページの内容が透けて見えていた。開く直前に必ず実測し直す
    this.updateViewportHeight();
    this.view.refs.dialog.style.opacity = "";
    const items = currentItems(this.state) as Item[];
    this.state.viewer.total = items.length;
    this.state.viewer.isOpen = true;
    this.state.viewer.photoPosX = 0;
    this.state.viewer.photoPosY = 0;
    this.setPosByCurrentIndex();
    this.setSizeByScreen();
    setArrow(this.state);
  }

  // resizeStyle: 'fill' はスマートフォンでのみ、画面を隙間なく覆うよう
  // scaleBorder() の倍率を viewer.scaleSize に適用する。fit用の item.scale に
  // 依存するため、setSizeByScreen() の末尾から必ず呼ばれる(個別に呼ぶ必要はない)
  private syncFillScale(): void {
    if (this.state.options.resizeStyle !== "fill" || !this.isSmartPhoneFlag) {
      return;
    }
    const item = currentItem(this.state);
    if (!item) {
      return;
    }
    this.state.viewer.scale = true;
    this.state.viewer.hideUi = true;
    this.state.viewer.scaleSize = scaleBorder(
      item,
      getWindowWidth(),
      getWindowHeight(),
      this.isSmartPhoneFlag,
    );
  }

  private supportsViewTransition(): boolean {
    return (
      this.state.options.useViewTransitionApi &&
      typeof (document as DocumentWithViewTransition).startViewTransition ===
        "function" &&
      // WebKit には「view-transition-name 付き要素が root スナップショットから
      // 除外されず、モーフ中に最終位置へ二重描画される」実装バグがあり、開く演出が
      // 「一旦ずれた位置に出てから正位置へ戻る」ように乱れる。API 対応の有無では
      // 検出できないため、WebKit ではクローン演出(addAppearEffect)へフォールバック
      // する(§util.isWebKit)
      !util.isWebKit()
    );
  }

  private openPhotoWithViewTransition(trigger: HTMLElement | null): void {
    // ::view-transition-group 等の疑似要素は document のルート要素(html)の子として
    // 扱われ、dialog に設定した --smartphoto-animation-speed を継承しない(§css)。
    // 開く直前に html へも同じ値を設定することで、複数インスタンスが異なる
    // animationSpeed を持つ場合でも「実際に開くインスタンスの値」が確実に使われる
    document.documentElement.style.setProperty(
      "--smartphoto-animation-speed",
      `${this.state.options.animationSpeed}ms`,
    );
    const transitionName = "smartphoto-hero";
    const thumbImg = trigger?.querySelector("img") ?? null;
    if (thumbImg) {
      thumbImg.style.viewTransitionName = transitionName;
    }
    // transition.finished が解決する頃には、その間の next()/prev() 操作により
    // currentIndex が変わっていることがある(§3.5 の前提が崩れるケース)ため、
    // currentImgElement() が見つからない場合は何もしない
    const cleanup = () => {
      this.isViewTransitionActive = false;
      if (thumbImg) {
        thumbImg.style.viewTransitionName = "";
      }
      const img = this.currentImgElement();
      if (img) {
        img.style.viewTransitionName = "";
      }
      // モーフ用に差し替えたレイアウト(applyViewTransitionLayout)を通常描画へ戻す。
      // commit() を常用しないのは、閉じるアニメーション中(isOpen=false)に render()
      // が doHideEffect() の設定したスライドアウトを上書きしてしまうため。
      // 閉じている場合は復元せず、次に開く際の commit() の書き直しに任せる
      if (!this.state.viewer.isOpen) {
        this.pendingViewTransitionResync = false;
        return;
      }
      if (this.pendingViewTransitionResync && currentItems(this.state)) {
        // トランジション中に保留したリサイズ再計算(§isViewTransitionActive)を
        // ここで実行する。commit() が新しいビューポート基準の width/transform を
        // 全スライドへ書き直すため、モーフ用レイアウトの復元も兼ねる
        this.pendingViewTransitionResync = false;
        this.updateViewportHeight();
        this.resetTranslateCurrent();
        this.setPosByCurrentIndex();
        this.setSizeByScreen();
        this.commit();
        return;
      }
      this.pendingViewTransitionResync = false;
      // render() を丸ごと呼ばず、モーフ用レイアウトの復元だけに限定する
      // (§view.ts resetViewTransitionLayout: caption/count の先行更新を避ける)
      this.view.resetViewTransitionLayout();
    };
    const transition = (
      document as DocumentWithViewTransition
    ).startViewTransition?.(() => {
      this.initPhoto();
      this.state.viewer.appear = true;
      this.commit();
      // 新しい状態のスナップショットを取る前に、サムネイル側の名前を必ず消しておく。
      // 消さずに大きい画像へ同じ名前を付けると、コールバック終了時点でサムネイルと
      // 大きい画像の2要素が同じ view-transition-name を持つことになり、ブラウザは
      // "Unexpected duplicate view-transition-name" として ready を reject し、
      // トランジション自体がスキップされてしまう(モーフアニメーションが効かず、
      // かつ稀に要素が visibility:hidden のまま残って再表示できなくなる)
      if (thumbImg) {
        thumbImg.style.viewTransitionName = "";
      }
      // openPhoto() が呼び出し前に該当グループへ view を同期済みのため、
      // この直後の時点では currentImgElement() は必ず見つかる(§3.5)
      (this.currentImgElement() as HTMLImageElement).style.viewTransitionName =
        transitionName;
      // 新しい状態のスナップショットが取られる前に、原寸レイアウト + 縮小 transform を
      // 表示寸法のレイアウトへ差し替え、ビューポート外相当部分の切り取り(WebKit で
      // モーフ中に画像の右側が黒く欠ける)を防ぐ(§view.ts applyViewTransitionLayout)
      this.view.applyViewTransitionLayout(this.state);
    });
    if (!transition) {
      return;
    }
    this.isViewTransitionActive = true;
    transition.ready.catch(() => {
      // 名前の重複などで setup に失敗した場合、ready は reject されるが
      // 実際の DOM 更新はコールバック内で既に完了しているため、後始末だけ行えばよい
      cleanup();
    });
    transition.finished.then(cleanup, cleanup);
  }

  // doOpen() の呼び出し元でこの分岐に来る時点で showAnimation !== false が保証されている
  private addAppearEffect(trigger: HTMLElement | null, item: Item): void {
    const img = trigger?.querySelector("img") ?? null;
    if (!img) {
      this.state.viewer.appear = true;
      return;
    }
    const pos = util.getViewPos(img);
    const width = img.offsetWidth;
    const height = img.offsetHeight;
    const toX = getWindowWidth();
    const toY = getWindowHeight();
    const screenY =
      toY - this.state.options.headerHeight - this.state.options.footerHeight;
    let scale = 1;

    if (this.state.options.resizeStyle === "fill" && this.isSmartPhoneFlag) {
      if (width > height) {
        scale = toY / height;
      } else {
        scale = toX / width;
      }
    } else {
      if (width >= height) {
        if (item.height < screenY) {
          scale = item.width / width;
        } else {
          scale = screenY / height;
        }
      } else {
        if (item.height < screenY) {
          scale = item.height / height;
        } else {
          scale = screenY / height;
        }
      }
      if (width * scale > toX) {
        scale = toX / width;
      }
    }

    const x = ((scale - 1) / 2) * width + (toX - width * scale) / 2;
    const y = ((scale - 1) / 2) * height + (toY - height * scale) / 2;
    const lazyImg = img.getAttribute(this.state.options.lazyAttribute);

    this.state.viewer.appearEffect = {
      width,
      height,
      top: pos.top,
      left: pos.left,
      once: true,
      img: lazyImg || item.src || "",
      afterX: x,
      afterY: y,
      scale,
    };
  }

  // showAppearEffect() が直前で refs.imgClone を必ず生成するため non-null が保証される
  private runAppearEffect(effect: AppearEffect): Promise<void> {
    this.view.showAppearEffect(effect);
    const clone = this.view.refs.imgClone as HTMLImageElement;
    return new Promise((resolve) => {
      const handler = () => {
        clone.removeEventListener("transitionend", handler, true);
        resolve();
      };
      clone.addEventListener("transitionend", handler, true);
      this.scheduleTimeout(() => {
        clone.style.transform = `translate(${effect.afterX}px, ${effect.afterY}px) scale(${effect.scale})`;
      }, 10);
    });
  }

  private doOpen(trigger: HTMLElement | null, item: Item): void {
    if (
      this.state.options.showAnimation !== false &&
      this.supportsViewTransition()
    ) {
      this.openPhotoWithViewTransition(trigger);
    } else if (this.state.options.showAnimation === false) {
      this.initPhoto();
      this.state.viewer.appear = true;
      this.commit();
    } else {
      this.initPhoto();
      this.addAppearEffect(trigger, item);
      this.commit();
      const effect = this.state.viewer.appearEffect;
      if (effect) {
        this.runAppearEffect(effect).then(() => {
          this.state.viewer.appearEffect = null;
          this.view.removeAppearEffect();
          this.state.viewer.appear = true;
          this.commit();
        });
      }
    }
    this.fireEvent("open");
    this.resyncSizeAfterOpen();
  }

  // initPhoto() 内の setSizeByScreen() は dialog がまだ showModal() 前(§: :root:has()
  // による overflow:hidden 未適用)の時点の getWindowWidth/Height() を使っている。
  // ページに縦スクロールバーがある環境ではその分だけ幅が狭く計測され、実際に
  // dialog が開いてスクロールバーが消えた後の幅とズレる。次の描画フレームで
  // 開いた後の正しいサイズを使って再計算し、必要なら再描画する
  private resyncSizeAfterOpen(): void {
    const winWidthBefore = getWindowWidth();
    const winHeightBefore = getWindowHeight();
    requestAnimationFrame(() => {
      if (!this.state.viewer.isOpen) {
        return;
      }
      if (
        getWindowWidth() === winWidthBefore &&
        getWindowHeight() === winHeightBefore
      ) {
        return;
      }
      if (this.isViewTransitionActive) {
        this.pendingViewTransitionResync = true;
        return;
      }
      this.resetTranslateCurrent();
      this.setPosByCurrentIndex();
      this.setSizeByScreen();
      this.commit();
    });
  }

  private openPhoto(item: Item, trigger: HTMLElement | null): void {
    // 文字列セレクタで構築した場合、開く直前に必ずグループをDOMの現在状態に
    // 合わせて再構築する(Ajax等による追加・削除・並び順の変化を反映)。
    // item.index はこの中で正しい値に更新される可能性がある
    const groupChanged = this.rootSelector
      ? this.resyncGroupFromDom(item.groupId)
      : false;
    this.lastTriggerElement = trigger;
    this.state.viewer.currentGroup = item.groupId;
    this.state.viewer.currentIndex = item.index;
    // グループを切り替えて開く場合、または resync でグループの中身が変わった場合、
    // view 側のスライド DOM は古いままなのでここで同期し直す
    // (§6: syncSlides はグループ切替・addItem 時に呼ぶ)
    if (this.syncedGroupId !== item.groupId || groupChanged) {
      this.syncCurrentGroupView();
    }
    this.setHashByCurrentIndex();
    if (item.loaded) {
      this.doOpen(trigger, item);
    } else {
      this.loadItem(item).then(() => {
        this.doOpen(trigger, item);
      });
    }
  }

  private doHideEffect(dir: "top" | "bottom"): Promise<void> {
    return new Promise((resolve) => {
      // showAnimation: false では syncDialog() が dialog の transition を
      // 止めている(§8)ため、画像側のスライドアウトや transitionend/タイマー
      // 待ちを行わずそのまま後始末へ進む
      if (this.state.options.showAnimation === false) {
        resolve();
        return;
      }
      const dialog = this.view.refs.dialog;
      const item = currentItem(this.state);
      const li = item ? this.currentLiElement() : null;
      const height = getWindowHeight();
      // タップ(zoomPhoto)やズーム解除(zoomOutPhoto)が開始した img の transform
      // transition が進行中のまま閉じると、閉じ演出(li のスライド + フェード)の
      // 間もズームが目標倍率へ向かって動き続け、「下に落ちる」はずの写真が
      // 「こちらへ迫ってくる」ように見える。updatePhotoTransform() で state の
      // 値(scaleSize=1)を再適用しないのは、それ自体が新たな transition となって
      // 縮小アニメーションが閉じ演出に重なってしまうため。代わりに、その時点で
      // 実際に描画されている値(補間途中なら matrix)をインラインへ書き戻すことで
      // transition をその場で打ち切り、現在の見た目のまま固定する
      const img = this.currentImgElement();
      // 後始末(finish)で凍結値を比較するための基準。setter に渡した文字列ではなく
      // CSSOM から読み戻した値を保持するのは、丸めの往復を一度通した canonical な
      // 文字列同士で比較するため(getComputedStyle 由来の matrix は既に canonical
      // だが、読み戻しで揃えておけばシリアライズ差異の影響を受けない)
      let frozenTransform: string | null = null;
      if (img) {
        const rendered = getComputedStyle(img).transform;
        if (rendered && rendered !== "none") {
          img.style.transform = rendered;
          frozenTransform = img.style.transform;
        }
      }
      // img/imgWrap には fit(item.scale)・fill(viewer.scaleSize)の拡大率が
      // 掛かっているため、そちらへ translateY を設定すると「画面上の実際の
      // 移動量が縮小される(item.scale が小さいほどほとんど動かない)」
      // 「拡大率を引き継がないと一瞬元の大きさへスナップする」といった問題が
      // 起きる上、巨大化された画像の中を垂直移動することになり、途中で別の
      // 部分(例: 口の奥)が露出して「被写体が迫ってくる」ように見えてしまう。
      // li はそれらのスケールが一切掛からない外側の要素なので、ここへ
      // translateY を適用すれば現在の見た目(拡大率・切り取り範囲)を一切
      // 変えずに、画面上をちょうど height ぶんだけ単純に垂直移動できる
      if (li && item) {
        const offsetY = dir === "top" ? -height : height;
        li.style.transform = `translate(${item.translateX}px,${item.translateY + offsetY}px)`;
      }
      const finish = (e?: Event) => {
        if (this.finishHideEffect !== finish) {
          return;
        }
        // dialog へは capture:true で束縛しているため、dialog 自身の opacity
        // transition だけでなく配下の任意の要素(list のスライド送りアニメーション
        // 等)の transitionend も拾ってしまう。直前にスライド送りをした直後に
        // 閉じた場合など、無関係な子要素の transitionend で閉じるアニメーションが
        // 早期に打ち切られていたため、dialog 自身が対象の場合のみ完了させる
        // (フォールバックのタイマー呼び出しには Event がなく、常に完了させる)
        if (e && e.target !== dialog) {
          return;
        }
        this.finishHideEffect = null;
        dialog.removeEventListener("transitionend", finish, true);
        // li.style.transform は hidePhoto() の呼び出し元である render()
        // (translateX/Y は state 由来)が直後に必ず正しい位置へ上書きするため、
        // ここで個別にリセットする必要はない。一方、transition の打ち切り用に
        // 凍結した img の transform(上記)は render() では上書きされない
        // (updatePhotoTransform 専任)ため、ここで除去する。無条件にクリア
        // しないのは、フォールバックタイマー実行までの間に再オープン後の
        // ズーム操作などが transform を上書きしている場合、その値を消して
        // しまわないようにするため
        if (img && frozenTransform && img.style.transform === frozenTransform) {
          img.style.transform = "";
        }
        resolve();
      };
      this.finishHideEffect = finish;
      dialog.addEventListener("transitionend", finish, true);
      // transitionend はトランジションが中断されると発火しない(閉じた直後の
      // 再オープンによる反転、タブ非表示、reduced-motion 等で transitioncancel に
      // なるケース)。その場合に translateY がインラインスタイルへ残留し、次に
      // 開いたとき画像が画面外へずれたままになるため、フォールバックで必ず後始末する
      this.scheduleTimeout(finish, this.state.options.animationSpeed + 100);
    });
  }

  // ---- 内部: ロード ----

  private loadItem(item: Item): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        item.width = img.width;
        item.height = img.height;
        item.loaded = true;
        this.checkLoadAll(item.groupId);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = item.src ?? "";
    });
  }

  private checkLoadAll(groupId: string): void {
    if (this.loadAllFired.has(groupId)) {
      return;
    }
    const items = this.state.groups.get(groupId);
    if (items?.length && items.every((i) => i.loaded)) {
      this.loadAllFired.add(groupId);
      this.fireEvent("loadall");
    }
  }

  private loadNeighborItems(): void {
    const items = currentItems(this.state);
    if (!items) {
      return;
    }
    const { currentIndex } = this.state.viewer;
    const { loadOffset } = this.state.options;
    const promises: Promise<void>[] = [];
    for (
      let i = currentIndex - loadOffset;
      i < currentIndex + loadOffset;
      i++
    ) {
      const item = items[i];
      if (item && !item.loaded) {
        promises.push(this.loadItem(item));
      }
    }
    if (promises.length) {
      Promise.all(promises).then(() => {
        // プリロードの解決前にユーザーが閉じている場合がある。initPhoto() は
        // isOpen を true に戻すため、ガードなしでは syncDialog() の showModal()
        // で閉じたビューアが復活してしまう(§resyncSizeAfterOpen と同じ方針)
        if (!this.state.viewer.isOpen) {
          return;
        }
        this.initPhoto();
        this.commit();
      });
    }
  }

  // ---- 内部: ナビゲーション ----

  private slideList(): void {
    this.state.viewer.scaleSize = 1;
    this.state.viewer.hideUi = false;
    this.state.viewer.scale = false;
    this.state.viewer.photoPosX = 0;
    this.state.viewer.photoPosY = 0;
    this.state.viewer.onMove = true;
    // モバイルではアドレスバーの表示/非表示に伴うビューポート変化が、矢印タップ等
    // による送りの直後・最中に非同期(visualViewportのresizeイベント)で起こることがある。
    // --smartphoto-vh(dialogの実高さ、CSS側)の更新タイミングとこの直後の
    // setSizeByScreen()(getWindowHeight()を都度計算、JS側)の間で高さがズレると、
    // 画像の中央配置が崩れて下寄り/上寄りに表示されるため、ここで明示的に同期する
    this.updateViewportHeight();
    this.setPosByCurrentIndex();
    this.setHashByCurrentIndex();
    this.setSizeByScreen();
    this.scheduleTimeout(() => {
      const item = currentItem(this.state);
      this.state.viewer.onMove = false;
      setArrow(this.state);
      // 送り操作の 200ms 後に必ず実行されるこの commit() には isOpen の
      // ガードがなかったため、送り直後(200ms以内)に閉じると、閉じるアニメーション
      // 中に commit() → updatePhotoTransform() が viewer.photoPosX/Y=0,
      // scaleSize=1 を img の transform へ再適用してしまい、doHideEffect() が
      // 設定した閉じるスライド(translateY)を上書きして消してしまっていた
      if (this.state.viewer.isOpen) {
        this.commit();
      }
      if (this.state.viewer.oldIndex !== this.state.viewer.currentIndex) {
        this.fireEvent("change");
      }
      this.state.viewer.oldIndex = this.state.viewer.currentIndex;
      this.loadNeighborItems();
      if (item && !item.loaded) {
        this.loadItem(item).then(() => {
          if (!this.state.viewer.isOpen) {
            return;
          }
          this.initPhoto();
          this.commit();
        });
      }
    }, 200);
  }

  // ---- 内部: タイマー(destroy 時に一括破棄) ----

  private scheduleTimeout(fn: () => void, delay: number): number {
    const id = window.setTimeout(() => {
      this.timeouts = this.timeouts.filter((t) => t !== id);
      fn();
    }, delay);
    this.timeouts.push(id);
    return id;
  }

  // ---- 内部: window イベント ----

  // --smartphoto-backdrop-color をホスト側 CSS が明示指定している場合のみ、
  // その背景色に対してコントラストの高い文字色/アイコン色(#000 or #fff)を
  // --smartphoto-icon-color として自動算出する。未指定(デフォルトの黒背景)の
  // ときは何もせず、CSS 側のフォールバック(既存の白固定)のままにする。
  // ホスト側 CSS が --smartphoto-icon-color 自体を明示指定している場合は、
  // 自動判定が誤検知したときの最終防衛ラインとしてその指定を必ず優先し、
  // 自動算出では上書きしない(dialog 要素へインラインスタイルで設定すると、
  // 後から通常の CSS ルールで !important なしに上書きできなくなるため)
  private applyAutoIconContrast(): void {
    const dialog = this.view.refs.dialog;
    const computed = getComputedStyle(dialog);
    if (computed.getPropertyValue("--smartphoto-icon-color").trim()) {
      return;
    }
    const backdropColor = computed
      .getPropertyValue("--smartphoto-backdrop-color")
      .trim();
    if (!backdropColor) {
      return;
    }
    dialog.style.setProperty(
      "--smartphoto-icon-color",
      util.getContrastColor(backdropColor),
    );
  }

  private updateViewportHeight = (): void => {
    this.view.refs.dialog.style.setProperty(
      "--smartphoto-vh",
      `${getWindowHeight()}px`,
    );
  };

  // iOS Safari 等ではアドレスバーの表示/非表示に伴う visualViewport の変化が
  // orientationchange を伴わず resize としてのみ発火する。スマートフォンでは
  // window の resize を購読していない(§コンストラクタ)ため、ここで拾わないと
  // 開いている間ずっと古い高さで計算された item.x/y がインラインスタイルに
  // 残り続け、表示中のスライドだけ位置がずれて見える(§Issue #95: スワイプ
  // ダウンで閉じて再度開いた際、閉じた瞬間表示していたスライドだけ縦位置がずれる)
  private handleVisualViewportResize = (): void => {
    this.updateViewportHeight();
    if (
      !this.isSmartPhoneFlag ||
      !this.state.viewer.isOpen ||
      !currentItems(this.state)
    ) {
      return;
    }
    if (this.isViewTransitionActive) {
      this.pendingViewTransitionResync = true;
      return;
    }
    this.resetTranslateCurrent();
    this.setPosByCurrentIndex();
    this.setSizeByScreen();
    this.commit();
  };

  private handleResize = (): void => {
    if (!this.state.viewer.isOpen || !currentItems(this.state)) {
      return;
    }
    // visualViewport 非対応環境では window の resize にこのハンドラを直接バインドしている
    // (§コンストラクタ)ため、--smartphoto-vh 側の更新をここでも保証する
    this.updateViewportHeight();
    if (this.isViewTransitionActive) {
      this.pendingViewTransitionResync = true;
      return;
    }
    this.resetTranslateCurrent();
    this.setPosByCurrentIndex();
    this.setSizeByScreen();
    this.commit();
  };

  private handleKeydown = (e: KeyboardEvent): void => {
    if (!this.state.viewer.isOpen) {
      return;
    }
    const code = e.keyCode || e.which;
    if (code === 37) {
      this.gotoSlide(this.state.viewer.prev);
    } else if (code === 39) {
      this.gotoSlide(this.state.viewer.next);
    } else if (code === 27) {
      this.hidePhoto();
    }
  };

  private handleOrientationChange = (): void => {
    if (!this.state.viewer.isOpen || !currentItems(this.state)) {
      return;
    }
    if (this.isViewTransitionActive) {
      this.pendingViewTransitionResync = true;
      return;
    }
    this.updateViewportHeight();
    this.resetTranslateCurrent();
    this.setPosByCurrentIndex();
    this.setHashByCurrentIndex();
    this.setSizeByScreen();
    this.commit();

    const prevWidth = getWindowWidth();
    const timeout = 500;
    const poll = (time: number): void => {
      this.scheduleTimeout(() => {
        if (!this.state.viewer.isOpen) {
          return;
        }
        if (prevWidth !== getWindowWidth()) {
          this.updateViewportHeight();
          this.resetTranslateCurrent();
          this.setPosByCurrentIndex();
          this.setHashByCurrentIndex();
          this.setSizeByScreen();
          this.commit();
        } else if (time <= timeout) {
          poll(time + 25);
        }
      }, 25);
    };
    poll(0);
  };

  // ---- 内部: イベント発火 ----

  private fireEvent(eventName: SmartPhotoEvent): void {
    util.triggerEvent(this.view.refs.dialog, eventName);
  }

  // ---- 内部: 結線 ----

  private buildViewHandlers(): ViewHandlers {
    return {
      onDismiss: () => this.hidePhoto(),
      onPrev: () => this.prev(),
      onNext: () => this.next(),
      onNavigate: (index) => this.gotoSlide(index),
      onBackdropClick: () => this.hidePhoto(),
    };
  }

  private buildGestureCallbacks(): GestureCallbacks {
    return {
      onSwipeStart: () => this.fireEvent("swipestart"),
      onSwipeMove: () => this.view.updateListTransform(this.state),
      onSwipeEnd: (result) => {
        this.fireEvent("swipeend");
        if (result === "close-bottom") {
          this.hidePhoto("bottom");
          return;
        }
        if (result === "close-top") {
          this.hidePhoto("top");
          return;
        }
        if (result === "prev") {
          this.state.viewer.currentIndex -= 1;
        } else if (result === "next") {
          this.state.viewer.currentIndex += 1;
        }
        this.slideList();
      },
      // 主要ライトボックスのデファクトスタンダード(PhotoSwipe: bgClickAction
      // 'close' / imageClickAction 'zoom-or-close'、Fancybox: backdropClick
      // 'close'、GLightbox: closeOnOutsideClick、lightGallery: closable)に合わせ、
      // 写真の上のタップはズーム、写真の外(背景)のタップは閉じる。ズームの
      // 余地がない(scaleBorder <= 1 で zoomPhoto() が何もしない)写真の上の
      // タップも、無反応にせず 'zoom-or-close' に倣って閉じる
      onTap: (target) => {
        const img = this.currentImgElement();
        const onPhoto = !!img && target instanceof Node && img.contains(target);
        if (onPhoto && this.canZoomCurrentPhoto()) {
          this.zoomPhoto();
        } else {
          this.hidePhoto();
        }
      },
      onGestureStart: () => {
        this.fireEvent("gesturestart");
        this.view.updatePhotoTransform(this.state);
      },
      onGestureMove: () => this.view.updatePhotoTransform(this.state),
      onGestureEnd: () => {
        this.fireEvent("gestureend");
        this.view.updatePhotoTransform(this.state);
      },
      onPhotoDragMove: () => this.view.updatePhotoTransform(this.state),
      onPhotoDragEnd: (result) => {
        if (result === "zoom-out") {
          this.zoomOutPhoto();
          return;
        }
        if (result === "prev") {
          this.gotoSlide(this.state.viewer.prev);
          return;
        }
        if (result === "next") {
          this.gotoSlide(this.state.viewer.next);
          return;
        }
        this.view.updatePhotoTransform(this.state);
      },
    };
  }
}
