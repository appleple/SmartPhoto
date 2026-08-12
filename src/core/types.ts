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

// state.options に格納される、デフォルト適用済みの完全形(内部専用)。公開する
// コンストラクタ引数は全プロパティ任意の SmartPhotoOptions であり、他社ライトボックス
// (PhotoSwipe の PhotoSwipeOptions/PreparedPhotoSwipeOptions 等)と同様、
// 完全形と公開設定型を分けて命名する
export interface ResolvedSmartPhotoOptions {
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

// コンストラクタに渡す公開設定型。PhotoSwipeOptions/SwiperOptions 同様、
// クラス名 + Options という命名にする(全プロパティ任意)
export type SmartPhotoOptions = Partial<
  Omit<ResolvedSmartPhotoOptions, "classNames" | "message">
> & {
  classNames?: Partial<ClassNames>;
  message?: Partial<Messages>;
};

export type ItemId = string | number;

// addItem()/addNewItem() が返す公開アイテム情報。レイアウト計算用の内部フィールド
// (translateX 等)は Item 側にのみ持たせ、公開型には含めない
export interface SmartPhotoItem {
  src: string | null;
  thumb: string | null;
  caption: string | null;
  alt: string | null;
  groupId: string;
  index: number;
  width: number;
  height: number;
  id: ItemId;
  loaded: boolean;
  element: HTMLElement | null;
}

// 内部専用の完全形。レイアウト計算(translateX/scale/x/y)と処理済みフラグを追加で持つ
export interface Item extends SmartPhotoItem {
  translateX: number;
  translateY: number;
  scale: number;
  x: number;
  y: number;
  processed: boolean;
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
  options: ResolvedSmartPhotoOptions;
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
// PhotoSwipe の SlideData に合わせた命名
export interface SlideData {
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
  | SlideData[];

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
