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

function getWindowWidth(): number {
  return document.documentElement.clientWidth;
}

// iOS Safari 等では document.documentElement.clientHeight が URL バーの表示/非表示に
// 追従せず、実際に見えている領域より大きい値を返すことがある(§css の --smartphoto-vh)。
// visualViewport.height の方が実測値として信頼できるため、対応環境ではそちらを優先する。
// ただし visualViewport.height はネイティブのピンチズーム(ブラウザ自体のページ拡大)が
// 掛かっている間、scale分だけ縮んだ値になる(2本指ピンチが touch-action:none を
// すり抜けてブラウザ本体のズームも誘発するケースがある)。scale を掛けて相殺しないと、
// そのタイミングの縮んだ値が --smartphoto-vh に固定され、ズーム後にdialogの下側が
// 余って背景(黒)が見えてしまう
function getWindowHeight(): number {
  const visualViewport = window.visualViewport;
  if (visualViewport) {
    return visualViewport.height * visualViewport.scale;
  }
  return document.documentElement.clientHeight;
}

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
    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        this.updateViewportHeight,
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
    this.state.viewer.currentIndex = Number.parseInt(String(index), 10);
    if (!this.state.viewer.currentIndex) {
      this.state.viewer.currentIndex = 0;
    }
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
      this.state.viewer.scale = true;
      this.view.updatePhotoTransform(this.state);
      this.fireEvent("zoomin");
    }, 300);
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

  // ---- 内部: dialog 制御(§8) ----

  private syncDialog(): void {
    const { dialog, caption } = this.view.refs;
    if (this.state.viewer.isOpen && !dialog.open) {
      dialog.showModal();
      caption.focus();
    } else if (!this.state.viewer.isOpen && dialog.open) {
      dialog.close();
    }
  }

  private commit(): void {
    this.view.render(this.state);
    this.syncDialog();
  }

  // ---- 内部: 開く演出 ----

  // initPhoto() は必ず有効なアイテムが存在するグループを開いた直後に呼ばれる
  // (doOpen/loadNeighborItems/slideList のいずれも呼び出し前に確認済み)
  private initPhoto(): void {
    // 直前の hidePhoto() のフェードアウトが transitionend 前に中断された場合に備え、
    // doHideEffect() の後始末(画像の translateY 除去など)を開く前に必ず完了させる
    this.finishHideEffect?.();
    this.view.refs.dialog.style.opacity = "";
    const items = currentItems(this.state) as Item[];
    this.state.viewer.total = items.length;
    this.state.viewer.isOpen = true;
    this.state.viewer.photoPosX = 0;
    this.state.viewer.photoPosY = 0;
    this.setPosByCurrentIndex();
    this.setSizeByScreen();
    setArrow(this.state);
    if (this.state.options.resizeStyle === "fill" && this.isSmartPhoneFlag) {
      const item = currentItem(this.state) as Item;
      this.state.viewer.scale = true;
      this.state.viewer.hideUi = true;
      this.state.viewer.scaleSize = scaleBorder(
        item,
        getWindowWidth(),
        getWindowHeight(),
        this.isSmartPhoneFlag,
      );
    }
  }

  private supportsViewTransition(): boolean {
    return (
      typeof (document as DocumentWithViewTransition).startViewTransition ===
      "function"
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
    const clearNames = () => {
      if (thumbImg) {
        thumbImg.style.viewTransitionName = "";
      }
      const img = this.currentImgElement();
      if (img) {
        img.style.viewTransitionName = "";
      }
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
    });
    transition?.ready.catch(() => {
      // 名前の重複などで setup に失敗した場合、ready は reject されるが
      // 実際の DOM 更新はコールバック内で既に完了しているため、後始末だけ行えばよい
      clearNames();
    });
    transition?.finished.then(clearNames, clearNames);
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
      this.resetTranslateCurrent();
      this.setPosByCurrentIndex();
      this.setSizeByScreen();
      this.view.render(this.state);
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
      const dialog = this.view.refs.dialog;
      const img = this.currentImgElement();
      const height = getWindowHeight();
      const applied =
        dir === "top" ? `translateY(-${height}px)` : `translateY(${height}px)`;
      const finish = () => {
        if (this.finishHideEffect !== finish) {
          return;
        }
        this.finishHideEffect = null;
        dialog.removeEventListener("transitionend", finish, true);
        // render() は translateX/Y や current クラスなど state 由来の値しか
        // 触らないため、ここで直接設定した transform は次に開くまでインライン
        // スタイルに残り続ける(旧 morphdom は毎回のテンプレート再生成で未知の
        // style を暗黙に消していたが、その相当処理はここで明示的に行う必要がある)。
        // フォールバック実行までの間に再オープン後のピンチ操作などが transform を
        // 上書きしている場合は、その値を消さないようここで設定した値のときだけ戻す
        if (img && img.style.transform === applied) {
          img.style.transform = "";
        }
        resolve();
      };
      this.finishHideEffect = finish;
      // dialog 自体のフェードアウトは scss 側の :not([open]) + allow-discrete
      // transition(§8)で CSS だけで完結させている。ここでは画像のスライド
      // アウトだけを JS で担当する
      if (img) {
        img.style.transform = applied;
      }
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
      this.commit();
      if (this.state.viewer.oldIndex !== this.state.viewer.currentIndex) {
        this.fireEvent("change");
      }
      this.state.viewer.oldIndex = this.state.viewer.currentIndex;
      this.loadNeighborItems();
      if (item && !item.loaded) {
        this.loadItem(item).then(() => {
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

  private updateViewportHeight = (): void => {
    this.view.refs.dialog.style.setProperty(
      "--smartphoto-vh",
      `${getWindowHeight()}px`,
    );
  };

  private handleResize = (): void => {
    if (!currentItems(this.state)) {
      return;
    }
    // visualViewport 非対応環境では window の resize にこのハンドラを直接バインドしている
    // (§コンストラクタ)ため、--smartphoto-vh 側の更新をここでも保証する
    this.updateViewportHeight();
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
    if (!currentItems(this.state)) {
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
      onTap: () => this.zoomPhoto(),
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
