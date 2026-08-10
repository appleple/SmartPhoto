export interface ClassNames {
  smartPhoto: string;
  smartPhotoClose: string;
  smartPhotoBody: string;
  smartPhotoInner: string;
  smartPhotoContent: string;
  smartPhotoImg: string;
  smartPhotoImgOnMove: string;
  smartPhotoImgElasticMove: string;
  smartPhotoImgWrap: string;
  smartPhotoArrows: string;
  smartPhotoNav: string;
  smartPhotoArrowRight: string;
  smartPhotoArrowLeft: string;
  smartPhotoArrowHideIcon: string;
  smartPhotoImgLeft: string;
  smartPhotoImgRight: string;
  smartPhotoList: string;
  smartPhotoListOnMove: string;
  smartPhotoHeader: string;
  smartPhotoCount: string;
  smartPhotoCaption: string;
  smartPhotoDismiss: string;
  smartPhotoLoader: string;
  smartPhotoLoaderWrap: string;
  smartPhotoImgClone: string;
}

export interface Messages {
  gotoNextImage: string;
  gotoPrevImage: string;
  closeDialog: string;
  // カルーセルコンテナのアクセシブルネーム。aria-roledescription="carousel" が
  // ロール名として読み上げられるため、"carousel" という語を含めないこと(APG)
  carouselLabel: string;
}

export interface SmartPhotoOptions {
  classNames: ClassNames;
  message: Messages;
  arrows: boolean;
  nav: boolean;
  showAnimation: boolean;
  verticalGravity: boolean;
  useOrientationApi: boolean;
  useHistoryApi: boolean;
  swipeTopToClose: boolean;
  swipeBottomToClose: boolean;
  swipeOffset: number;
  swipeVelocity: number;
  headerHeight: number;
  footerHeight: number;
  forceInterval: number;
  registance: number;
  loadOffset: number;
  resizeStyle: "fit" | "fill";
  lazyAttribute: string;
  animationSpeed: number;
}

export type SmartPhotoSettings = Partial<
  Omit<SmartPhotoOptions, "classNames" | "message">
> & {
  classNames?: Partial<ClassNames>;
  message?: Partial<Messages>;
};

export type ItemId = string | number;

export interface Item {
  src: string | null;
  thumb: string | null;
  caption: string | null;
  alt: string | null;
  groupId: string;
  translateX: number;
  translateY: number;
  index: number;
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
  id: ItemId;
  loaded: boolean;
  processed: boolean;
  element: HTMLElement | null;
}

export interface AppearEffect {
  width: number;
  height: number;
  top: number;
  left: number;
  once: boolean;
  img: string;
  afterX: number;
  afterY: number;
  scale: number;
}

export interface ViewerState {
  isOpen: boolean;
  currentGroup: string | null;
  currentIndex: number;
  oldIndex: number;
  total: number;
  translateX: number;
  translateY: number;
  photoPosX: number;
  photoPosY: number;
  scaleSize: number;
  scale: boolean;
  elastic: boolean;
  hideUi: boolean;
  onMove: boolean;
  appear: boolean;
  appearEffect: AppearEffect | null;
  prev: number;
  next: number;
  showPrevArrow: boolean;
  showNextArrow: boolean;
}

export interface State {
  options: SmartPhotoOptions;
  viewer: ViewerState;
  groups: Map<string, Item[]>;
}

export interface Bound {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// プログラマブル API(データソースモード)で渡すスライド定義。§3.2
export interface Slide {
  src: string;
  thumb?: string;
  caption?: string;
  alt?: string;
  id?: ItemId;
  group?: string;
  width?: number;
  height?: number;
}

export type SmartPhotoSource =
  | string
  | NodeListOf<Element>
  | Element[]
  | Slide[];

export type SmartPhotoEvent =
  | "open"
  | "close"
  | "change"
  | "swipestart"
  | "swipeend"
  | "zoomin"
  | "zoomout"
  | "gesturestart"
  | "gestureend"
  | "loadall";

export type SwipeEndResult =
  | "prev"
  | "next"
  | "close-top"
  | "close-bottom"
  | "stay";
export type PhotoDragEndResult = "prev" | "next" | "zoom-out" | null;

export interface GestureCallbacks {
  onSwipeStart(): void;
  onSwipeMove(): void;
  onSwipeEnd(result: SwipeEndResult): void;
  onTap(): void;
  onGestureStart(): void;
  onGestureMove(): void;
  onGestureEnd(): void;
  onPhotoDragMove(): void;
  onPhotoDragEnd(result: PhotoDragEndResult): void;
}
