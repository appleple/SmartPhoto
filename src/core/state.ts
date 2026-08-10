import * as util from "../lib/util";
import type {
  Bound,
  Item,
  Slide,
  SmartPhotoOptions,
  SmartPhotoSettings,
  State,
  ViewerState,
} from "./types";

export const defaults: SmartPhotoOptions = {
  classNames: {
    smartPhoto: "smartphoto",
    smartPhotoClose: "smartphoto-close",
    smartPhotoBody: "smartphoto-body",
    smartPhotoInner: "smartphoto-inner",
    smartPhotoContent: "smartphoto-content",
    smartPhotoImg: "smartphoto-img",
    smartPhotoImgOnMove: "smartphoto-img-onmove",
    smartPhotoImgElasticMove: "smartphoto-img-elasticmove",
    smartPhotoImgWrap: "smartphoto-img-wrap",
    smartPhotoArrows: "smartphoto-arrows",
    smartPhotoNav: "smartphoto-nav",
    smartPhotoArrowRight: "smartphoto-arrow-right",
    smartPhotoArrowLeft: "smartphoto-arrow-left",
    smartPhotoArrowHideIcon: "smartphoto-arrow-hide",
    smartPhotoImgLeft: "smartphoto-img-left",
    smartPhotoImgRight: "smartphoto-img-right",
    smartPhotoList: "smartphoto-list",
    smartPhotoListOnMove: "smartphoto-list-onmove",
    smartPhotoHeader: "smartphoto-header",
    smartPhotoCount: "smartphoto-count",
    smartPhotoCaption: "smartphoto-caption",
    smartPhotoDismiss: "smartphoto-dismiss",
    smartPhotoLoader: "smartphoto-loader",
    smartPhotoLoaderWrap: "smartphoto-loader-wrap",
    smartPhotoImgClone: "smartphoto-img-clone",
  },
  message: {
    gotoNextImage: "go to the next image",
    gotoPrevImage: "go to the previous image",
    closeDialog: "close the image dialog",
    carouselLabel: "Images",
  },
  arrows: true,
  nav: true,
  showAnimation: true,
  verticalGravity: false,
  useOrientationApi: false,
  useHistoryApi: true,
  swipeTopToClose: false,
  swipeBottomToClose: true,
  swipeOffset: 100,
  headerHeight: 60,
  footerHeight: 60,
  forceInterval: 10,
  registance: 0.5,
  loadOffset: 2,
  resizeStyle: "fit",
  lazyAttribute: "data-src",
  animationSpeed: 300,
};

function deepFreeze<T>(obj: T): Readonly<T> {
  Object.keys(obj as object).forEach((key) => {
    const value = (obj as Record<string, unknown>)[key];
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}

export function createState(settings: SmartPhotoSettings): State {
  return {
    options: deepFreeze(
      util.extend({}, defaults, settings) as unknown as SmartPhotoOptions,
    ),
    viewer: {
      isOpen: false,
      currentGroup: null,
      currentIndex: 0,
      oldIndex: 0,
      total: 0,
      translateX: 0,
      translateY: 0,
      photoPosX: 0,
      photoPosY: 0,
      scaleSize: 1,
      scale: false,
      elastic: false,
      hideUi: false,
      onMove: false,
      appear: false,
      appearEffect: null,
      prev: -1,
      next: -1,
      showPrevArrow: false,
      showNextArrow: false,
    },
    groups: new Map(),
  };
}

export function groupIdFromElement(element: Element): string {
  return element.getAttribute("data-group") || "nogroup";
}

export function groupIdFromSlide(slide: Slide): string {
  return slide.group || "nogroup";
}

// 旧 addNewItem の thumb/alt/id 決定ロジックをそのまま移植(behavior 互換の要)
export function itemFromElement(
  element: Element,
  options: Pick<SmartPhotoOptions, "lazyAttribute">,
  index: number,
  winWidth: number,
): Item {
  const groupId = groupIdFromElement(element);
  const src = element.getAttribute("href");
  const img = element.querySelector("img");
  let thumb = src;
  if (img) {
    if (img.getAttribute(options.lazyAttribute)) {
      thumb = img.getAttribute(options.lazyAttribute);
    } else if (img.currentSrc) {
      thumb = img.currentSrc;
    } else {
      thumb = img.src;
    }
  }
  let alt = "";
  if (img?.getAttribute("alt")) {
    alt = img.getAttribute("alt") as string;
  } else if (element.getAttribute("data-caption")) {
    alt = element.getAttribute("data-caption") as string;
  } else {
    alt = src ?? "";
  }
  const dataId = element.getAttribute("data-id");
  return {
    src,
    thumb,
    caption: element.getAttribute("data-caption"),
    alt,
    groupId,
    translateX: winWidth * index,
    translateY: 0,
    index,
    width: 50,
    height: 50,
    scale: 1,
    x: 0,
    y: 0,
    id: dataId || index,
    loaded: false,
    processed: false,
    element: element as HTMLElement,
  };
}

// データソースモード用ファクトリ(§3.5): width/height 指定時は計測プリロードをスキップする
export function itemFromSlide(
  slide: Slide,
  index: number,
  winWidth: number,
): Item {
  const groupId = groupIdFromSlide(slide);
  const src = slide.src;
  const thumb = slide.thumb ?? src;
  const caption = slide.caption ?? null;
  const alt = slide.alt ?? caption ?? src;
  const hasSize =
    typeof slide.width === "number" && typeof slide.height === "number";
  return {
    src,
    thumb,
    caption,
    alt,
    groupId,
    translateX: winWidth * index,
    translateY: 0,
    index,
    width: hasSize ? (slide.width as number) : 50,
    height: hasSize ? (slide.height as number) : 50,
    scale: 1,
    x: 0,
    y: 0,
    id: slide.id ?? index,
    loaded: hasSize,
    processed: false,
    element: null,
  };
}

export function addItemToGroup(state: State, item: Item): void {
  if (!state.groups.has(item.groupId)) {
    state.groups.set(item.groupId, []);
  }
  // biome-ignore lint/style/noNonNullAssertion: 直前で必ず存在させている
  state.groups.get(item.groupId)!.push(item);
  state.viewer.currentGroup = item.groupId;
}

export function currentItems(state: State): Item[] | null {
  if (state.viewer.currentGroup === null) {
    return null;
  }
  return state.groups.get(state.viewer.currentGroup) ?? null;
}

export function currentItem(state: State): Item | null {
  const items = currentItems(state);
  return items ? (items[state.viewer.currentIndex] ?? null) : null;
}

export function setArrow(state: State): void {
  const items = currentItems(state);
  if (!items) {
    return;
  }
  const length = items.length;
  const next = state.viewer.currentIndex + 1;
  const prev = state.viewer.currentIndex - 1;
  state.viewer.showNextArrow = false;
  state.viewer.showPrevArrow = false;
  if (next !== length) {
    state.viewer.next = next;
    state.viewer.showNextArrow = true;
  }
  if (prev !== -1) {
    state.viewer.prev = prev;
    state.viewer.showPrevArrow = true;
  }
}

export function resetTranslate(items: Item[], winWidth: number): void {
  items.forEach((item, index) => {
    item.translateX = winWidth * index;
  });
}

function round(val: number, precision: number): number {
  const digit = 10 ** precision;
  return Math.round(val * digit) / digit;
}

// 旧 _getScaleBoarder の数式をそのまま移植。isSmartPhone は呼び出し側から渡す(§5)
export function scaleBorder(
  item: Item,
  winWidth: number,
  winHeight: number,
  isSmartPhone: boolean,
): number {
  if (!isSmartPhone) {
    return 1 / item.scale;
  }
  if (item.width > item.height) {
    return winHeight / (item.height * item.scale);
  }
  return winWidth / (item.width * item.scale);
}

// 旧 _makeBound の数式をそのまま移植
export function makeBound(
  item: Item,
  viewer: Pick<ViewerState, "scaleSize">,
  winWidth: number,
  winHeight: number,
): Bound {
  const width = item.width * item.scale * viewer.scaleSize;
  const height = item.height * item.scale * viewer.scaleSize;
  let minX: number;
  let minY: number;
  let maxX: number;
  let maxY: number;
  if (winWidth > width) {
    maxX = (winWidth - width) / 2;
    minX = -1 * maxX;
  } else {
    maxX = (width - winWidth) / 2;
    minX = -1 * maxX;
  }
  if (winHeight > height) {
    maxY = (winHeight - height) / 2;
    minY = -1 * maxY;
  } else {
    maxY = (height - winHeight) / 2;
    minY = -1 * maxY;
  }
  return {
    minX: round(minX, 6) * viewer.scaleSize,
    minY: round(minY, 6) * viewer.scaleSize,
    maxX: round(maxX, 6) * viewer.scaleSize,
    maxY: round(maxY, 6) * viewer.scaleSize,
  };
}

// 旧 _setSizeByScreen の数式をそのまま移植(y を最終分岐で再計算しない挙動も含む)
export function sizeItems(
  items: Item[],
  winWidth: number,
  winHeight: number,
  headerHeight: number,
  footerHeight: number,
): void {
  const screenY = winHeight - (headerHeight + footerHeight);
  items.forEach((item) => {
    if (!item.loaded) {
      return;
    }
    item.processed = true;
    item.scale = screenY / item.height;
    if (item.height < screenY) {
      item.scale = 1;
    }
    item.x =
      ((item.scale - 1) / 2) * item.width +
      (winWidth - item.width * item.scale) / 2;
    item.y =
      ((item.scale - 1) / 2) * item.height +
      (winHeight - item.height * item.scale) / 2;
    if (item.width * item.scale > winWidth) {
      item.scale = winWidth / item.width;
      item.x = ((item.scale - 1) / 2) * item.width;
    }
  });
}

export function buildHash(state: State): string {
  const item = currentItem(state);
  if (!item) {
    return "";
  }
  return `group=${state.viewer.currentGroup}&photo=${item.id}`;
}

export function findItemByHash(
  state: State,
  hashObj: { group?: string; photo?: string },
): Item | null {
  let found: Item | null = null;
  state.groups.forEach((items) => {
    items.forEach((item) => {
      if (hashObj.group === item.groupId && hashObj.photo === item.id) {
        found = item;
      }
    });
  });
  return found;
}
