import type { AppearEffect, Item, SmartPhotoOptions, State } from "./types";

interface SlideRefs {
  li: HTMLLIElement;
  loaderWrap: HTMLDivElement | null;
  imgWrap: HTMLDivElement | null;
  img: HTMLImageElement | null;
  navLink: HTMLButtonElement | null;
}

export interface ViewRefs {
  dialog: HTMLDialogElement;
  count: HTMLSpanElement;
  caption: HTMLHeadingElement;
  dismiss: HTMLButtonElement;
  content: HTMLDivElement;
  list: HTMLUListElement;
  arrows: HTMLUListElement | null;
  arrowLeft: HTMLLIElement | null;
  arrowRight: HTMLLIElement | null;
  nav: HTMLElement | null;
  navList: HTMLUListElement | null;
  slides: Map<Item, SlideRefs>;
  imgClone: HTMLImageElement | null;
}

export interface ViewHandlers {
  onDismiss(): void;
  onPrev(): void;
  onNext(): void;
  onNavigate(index: number): void;
  onBackdropClick(): void;
}

export interface View {
  root: HTMLDivElement;
  refs: ViewRefs;
  render(state: State): void;
  syncSlides(items: Item[], state: State): void;
  updatePhotoTransform(state: State): void;
  updateListTransform(state: State): void;
  showAppearEffect(effect: AppearEffect): void;
  removeAppearEffect(): void;
  destroy(): void;
}

function srOnly(text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "smartphoto-sr-only";
  span.textContent = text;
  return span;
}

// APG の button パターンが要求する Enter/Space での作動・フォーカス可能性・button
// ロールをブラウザ実装に任せるため、操作要素はネイティブ <button> で作る
// (v2 まで <a href="#" role="button"> だったが Space で作動しない問題があった)
function buildButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  return button;
}

function escapeCssUrl(value: string): string {
  return value.replace(/"/g, '\\"');
}

// DOM 構造は §6.2 の現行構造を維持する(CSS 契約)。動的な値は textContent/setAttribute/
// style.* だけで設定し、HTML 文字列連結は使わない(§6.4 XSS 方針)
export function createView(
  { id, options }: { id: string; options: SmartPhotoOptions },
  handlers: ViewHandlers,
  { signal }: { signal: AbortSignal },
): View {
  const { classNames, message } = options;

  const root = document.createElement("div");
  root.setAttribute("data-id", id);

  const dialog = document.createElement("dialog");
  dialog.className = classNames.smartPhoto;
  dialog.setAttribute("aria-labelledby", `smartphoto-${id}-title`);
  dialog.style.setProperty(
    "--smartphoto-animation-speed",
    `${options.animationSpeed}ms`,
  );

  const body = document.createElement("div");
  body.className = classNames.smartPhotoBody;

  const inner = document.createElement("div");
  inner.className = classNames.smartPhotoInner;

  const header = document.createElement("div");
  header.className = classNames.smartPhotoHeader;

  const count = document.createElement("span");
  count.className = classNames.smartPhotoCount;

  // スライド切り替えの通知はスライドコンテナ(list)のライブリージョンが担う(APG)。
  // caption にも aria-live を付けると同じ名前が二重に読み上げられるため付けない
  const caption = document.createElement("h1");
  caption.id = `smartphoto-${id}-title`;
  caption.className = classNames.smartPhotoCaption;
  caption.setAttribute("tabindex", "-1");

  const dismiss = document.createElement("button");
  dismiss.className = classNames.smartPhotoDismiss;
  dismiss.appendChild(srOnly(message.closeDialog));
  dismiss.addEventListener("click", () => handlers.onDismiss(), { signal });

  header.append(count, caption, dismiss);

  const content = document.createElement("div");
  content.className = classNames.smartPhotoContent;
  content.addEventListener(
    "click",
    (e) => {
      if (e.target === content) {
        handlers.onBackdropClick();
      }
    },
    { signal },
  );

  // APG carousel パターン: コンテナは region ロール + "carousel" を含まない
  // アクセシブルネーム + aria-roledescription="carousel"。自動回転機能はないため
  // aria-live は常に polite でよい。スライド切り替え時に非カレントスライドの
  // aria-hidden を付け替える(render 参照)ことで、新たに露出したスライドの内容
  // (ラベルと画像の alt)がこのライブリージョン経由で読み上げられる
  const list = document.createElement("ul");
  list.className = classNames.smartPhotoList;
  list.setAttribute("role", "region");
  list.setAttribute("aria-roledescription", "carousel");
  list.setAttribute("aria-label", message.carouselLabel);
  list.setAttribute("aria-live", "polite");
  list.setAttribute("aria-atomic", "false");

  inner.append(header, content, list);

  let arrows: HTMLUListElement | null = null;
  let arrowLeft: HTMLLIElement | null = null;
  let arrowRight: HTMLLIElement | null = null;
  if (options.arrows) {
    arrows = document.createElement("ul");
    arrows.className = classNames.smartPhotoArrows;

    arrowLeft = document.createElement("li");
    arrowLeft.className = classNames.smartPhotoArrowLeft;
    const prevButton = buildButton();
    prevButton.appendChild(srOnly(message.gotoPrevImage));
    prevButton.addEventListener("click", () => handlers.onPrev(), { signal });
    arrowLeft.appendChild(prevButton);

    arrowRight = document.createElement("li");
    arrowRight.className = classNames.smartPhotoArrowRight;
    const nextButton = buildButton();
    nextButton.appendChild(srOnly(message.gotoNextImage));
    nextButton.addEventListener("click", () => handlers.onNext(), { signal });
    arrowRight.appendChild(nextButton);

    arrows.append(arrowLeft, arrowRight);
    inner.appendChild(arrows);
  }

  let nav: HTMLElement | null = null;
  let navList: HTMLUListElement | null = null;
  if (options.nav) {
    nav = document.createElement("nav");
    nav.className = classNames.smartPhotoNav;
    nav.setAttribute("aria-label", "Choose slide to display");
    navList = document.createElement("ul");
    nav.appendChild(navList);
    inner.appendChild(nav);
  }

  body.appendChild(inner);
  dialog.appendChild(body);
  root.appendChild(dialog);

  const refs: ViewRefs = {
    dialog,
    count,
    caption,
    dismiss,
    content,
    list,
    arrows,
    arrowLeft,
    arrowRight,
    nav,
    navList,
    slides: new Map(),
    imgClone: null,
  };

  function buildLoaderWrap(): HTMLDivElement {
    const loaderWrap = document.createElement("div");
    loaderWrap.className = classNames.smartPhotoLoaderWrap;
    const loader = document.createElement("span");
    loader.className = classNames.smartPhotoLoader;
    loaderWrap.appendChild(loader);
    return loaderWrap;
  }

  function buildImgWrap(item: Item): {
    imgWrap: HTMLDivElement;
    img: HTMLImageElement;
  } {
    const imgWrap = document.createElement("div");
    imgWrap.className = classNames.smartPhotoImgWrap;
    const img = document.createElement("img");
    img.className = classNames.smartPhotoImg;
    img.src = item.src ?? "";
    img.alt = item.alt ?? "";
    img.addEventListener("dragstart", (e) => e.preventDefault(), { signal });
    imgWrap.appendChild(img);
    return { imgWrap, img };
  }

  function syncSlides(items: Item[], state: State): void {
    refs.list.replaceChildren();
    refs.navList?.replaceChildren();
    refs.slides = new Map();

    items.forEach((item) => {
      const li = document.createElement("li");
      li.setAttribute("role", "group");
      li.setAttribute("aria-roledescription", "slide");
      // スライド名(caption/alt)は画像の alt として読み上げられるため、
      // ラベルは APG の「N of M」形式で位置情報を伝える
      li.setAttribute("aria-label", `${item.index + 1} of ${items.length}`);

      const slideRefs: SlideRefs = {
        li,
        loaderWrap: null,
        imgWrap: null,
        img: null,
        navLink: null,
      };

      if (item.processed) {
        const { imgWrap, img } = buildImgWrap(item);
        li.appendChild(imgWrap);
        slideRefs.imgWrap = imgWrap;
        slideRefs.img = img;
      } else {
        const loaderWrap = buildLoaderWrap();
        li.appendChild(loaderWrap);
        slideRefs.loaderWrap = loaderWrap;
      }

      refs.list.appendChild(li);
      refs.slides.set(item, slideRefs);

      if (refs.navList) {
        const navLi = document.createElement("li");
        const navLink = buildButton();
        navLink.style.backgroundImage = `url("${escapeCssUrl(item.thumb ?? "")}")`;
        const index = item.index;
        navLink.addEventListener("click", () => handlers.onNavigate(index), {
          signal,
        });
        navLink.appendChild(srOnly(`go to ${item.caption ?? ""}`));
        navLi.appendChild(navLink);
        refs.navList.appendChild(navLi);
        slideRefs.navLink = navLink;
      }
    });

    render(state);
  }

  function upgradeIfProcessed(item: Item, slideRefs: SlideRefs): SlideRefs {
    if (slideRefs.imgWrap || !item.processed) {
      return slideRefs;
    }
    const { imgWrap, img } = buildImgWrap(item);
    slideRefs.loaderWrap?.replaceWith(imgWrap);
    slideRefs.loaderWrap = null;
    slideRefs.imgWrap = imgWrap;
    slideRefs.img = img;
    return slideRefs;
  }

  // フォーカスが当たっている要素に aria-hidden="true" を付けると、ブラウザは
  // 「フォーカスされた子孫を持つ要素を支援技術から隠せない」として付与自体を
  // ブロックし、コンソールに警告を出す(例: 最後のスライドで次へボタンを押した
  // 直後、その <a> にフォーカスが残ったまま矢印の <li> が非表示になるケース)。
  // 隠す前にフォーカスをキャプション側へ逃がしておく
  function hideFromA11yIfFocused(el: Element | null): void {
    if (el && document.activeElement && el.contains(document.activeElement)) {
      refs.caption.focus();
    }
  }

  function render(state: State): void {
    const { viewer } = state;
    refs.count.textContent = `${viewer.currentIndex + 1}/${viewer.total}`;

    refs.slides.forEach((rawSlideRefs, item) => {
      const slideRefs = upgradeIfProcessed(item, rawSlideRefs);
      const isCurrent = item.index === viewer.currentIndex;
      slideRefs.li.style.transform = `translate(${item.translateX}px,${item.translateY}px)`;
      slideRefs.li.classList.toggle("current", isCurrent);
      // 非カレントスライドは画面外に translate されているだけで支援技術には見えて
      // しまうため隠す。カレントの aria-hidden 解除は、コンテナ(list)のライブ
      // リージョンに対する「内容の追加」となり、新しいスライドが読み上げられる(APG)
      if (isCurrent) {
        slideRefs.li.removeAttribute("aria-hidden");
      } else {
        slideRefs.li.setAttribute("aria-hidden", "true");
      }
      if (isCurrent) {
        refs.caption.textContent = item.caption ?? "";
      }
      if (slideRefs.imgWrap && slideRefs.img) {
        slideRefs.imgWrap.style.transform = `translate(${item.x}px,${item.y}px) scale(${item.scale})`;
        slideRefs.img.style.width = `${item.width}px`;
        slideRefs.img.classList.toggle("active", viewer.appear);
        slideRefs.img.classList.toggle(
          classNames.smartPhotoImgOnMove,
          viewer.scale,
        );
        slideRefs.img.classList.toggle(
          classNames.smartPhotoImgElasticMove,
          viewer.elastic,
        );
      }
      if (slideRefs.navLink) {
        slideRefs.navLink.classList.toggle("current", isCurrent);
        if (isCurrent) {
          slideRefs.navLink.setAttribute("aria-current", "true");
        } else {
          slideRefs.navLink.removeAttribute("aria-current");
        }
      }
    });

    if (refs.arrowLeft) {
      if (viewer.showPrevArrow) {
        refs.arrowLeft.removeAttribute("aria-hidden");
      } else {
        hideFromA11yIfFocused(refs.arrowLeft);
        refs.arrowLeft.setAttribute("aria-hidden", "true");
      }
    }
    if (refs.arrowRight) {
      if (viewer.showNextArrow) {
        refs.arrowRight.removeAttribute("aria-hidden");
      } else {
        hideFromA11yIfFocused(refs.arrowRight);
        refs.arrowRight.setAttribute("aria-hidden", "true");
      }
    }
    if (refs.arrows) {
      if (viewer.hideUi) {
        hideFromA11yIfFocused(refs.arrows);
      }
      refs.arrows.setAttribute("aria-hidden", viewer.hideUi ? "true" : "false");
    }
    if (refs.nav) {
      if (viewer.hideUi) {
        hideFromA11yIfFocused(refs.nav);
      }
      refs.nav.setAttribute("aria-hidden", viewer.hideUi ? "true" : "false");
    }
  }

  function findCurrentSlideRefs(state: State): SlideRefs | null {
    for (const [item, slideRefs] of refs.slides) {
      if (item.index === state.viewer.currentIndex) {
        return slideRefs;
      }
    }
    return null;
  }

  function updatePhotoTransform(state: State): void {
    const { viewer } = state;
    const slideRefs = findCurrentSlideRefs(state);
    const img = slideRefs?.img;
    if (img) {
      img.style.transform = `translate(${viewer.photoPosX}px,${viewer.photoPosY}px) scale(${viewer.scaleSize})`;
      img.classList.toggle(classNames.smartPhotoImgOnMove, viewer.scale);
      img.classList.toggle(classNames.smartPhotoImgElasticMove, viewer.elastic);
    }
    if (refs.nav) {
      if (viewer.hideUi) {
        hideFromA11yIfFocused(refs.nav);
      }
      refs.nav.setAttribute("aria-hidden", viewer.hideUi ? "true" : "false");
    }
    if (refs.arrows) {
      if (viewer.hideUi) {
        hideFromA11yIfFocused(refs.arrows);
      }
      refs.arrows.setAttribute("aria-hidden", viewer.hideUi ? "true" : "false");
    }
  }

  function updateListTransform(state: State): void {
    const { viewer } = state;
    refs.list.style.transform = `translate(${viewer.translateX}px,${viewer.translateY}px)`;
    refs.list.classList.toggle(classNames.smartPhotoListOnMove, viewer.onMove);
  }

  function showAppearEffect(effect: AppearEffect): void {
    const clone = document.createElement("img");
    clone.className = classNames.smartPhotoImgClone;
    clone.src = effect.img;
    clone.style.width = `${effect.width}px`;
    clone.style.height = `${effect.height}px`;
    clone.style.transform = `translate(${effect.left}px,${effect.top}px) scale(1)`;
    body.appendChild(clone);
    refs.imgClone = clone;
  }

  function removeAppearEffect(): void {
    refs.imgClone?.remove();
    refs.imgClone = null;
  }

  function destroy(): void {
    root.remove();
  }

  return {
    root,
    refs,
    render,
    syncSlides,
    updatePhotoTransform,
    updateListTransform,
    showAppearEffect,
    removeAppearEffect,
    destroy,
  };
}
