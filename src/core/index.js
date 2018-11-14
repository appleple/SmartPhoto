import ATemplate from 'a-template';
import 'custom-event-polyfill';

import template from './viwer.html';

const util = require('../lib/util');
const Promise = require('es6-promise-polyfill').Promise;

const defaults = {
  classNames: {
    smartPhoto: 'smartphoto',
    smartPhotoClose: 'smartphoto-close',
    smartPhotoBody: 'smartphoto-body',
    smartPhotoInner: 'smartphoto-inner',
    smartPhotoContent: 'smartphoto-content',
    smartPhotoImg: 'smartphoto-img',
    smartPhotoImgOnMove: 'smartphoto-img-onmove',
    smartPhotoImgElasticMove: 'smartphoto-img-elasticmove',
    smartPhotoImgWrap: 'smartphoto-img-wrap',
    smartPhotoArrows: 'smartphoto-arrows',
    smartPhotoNav: 'smartphoto-nav',
    smartPhotoArrowRight: 'smartphoto-arrow-right',
    smartPhotoArrowLeft: 'smartphoto-arrow-left',
    smartPhotoArrowHideIcon: 'smartphoto-arrow-hide',
    smartPhotoImgLeft: 'smartphoto-img-left',
    smartPhotoImgRight: 'smartphoto-img-right',
    smartPhotoList: 'smartphoto-list',
    smartPhotoListOnMove: 'smartphoto-list-onmove',
    smartPhotoHeader: 'smartphoto-header',
    smartPhotoCount: 'smartphoto-count',
    smartPhotoCaption: 'smartphoto-caption',
    smartPhotoDismiss: 'smartphoto-dismiss',
    smartPhotoLoader: 'smartphoto-loader',
    smartPhotoLoaderWrap: 'smartphoto-loader-wrap',
    smartPhotoImgClone: 'smartphoto-img-clone'
  },
  message: {
    gotoNextImage: 'go to the next image',
    gotoPrevImage: 'go to the previous image',
    closeDialog: 'close the image dialog'
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
  resizeStyle: 'fit',
};

export default class SmartPhoto extends ATemplate {

  constructor(selector, settings) {
    super();
    this.data = util.extend({}, defaults, settings);
    this.data.currentIndex = 0;
    this.data.oldIndex = 0;
    this.data.hide = true;
    this.data.group = {};
    this.data.scaleSize = 1;
    this.data.scale = false;
    this.pos = { x: 0, y: 0 };
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this.convert = {
      increment: this.increment,
      virtualPos: this.virtualPos,
      round: this.round
    };
    this.data.groupItems = this.groupItems;
    this.elements = typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
    const date = new Date();
    this.tapSecond = date.getTime();
    this.onListMove = false;
    this.clicked = false;
    this.id = this._getUniqId();
    this.vx = 0;
    this.vy = 0;
    this.data.appearEffect = null;
    this.addTemplate(this.id, template);
    this.data.isSmartPhone = this._isSmartPhone();
    const body = document.querySelector('body');
    util.append(body, `<div data-id='${this.id}'></div>`);
    [].forEach.call(this.elements, (element) => {
      this.addNewItem(element);
    });

    this.update();
    const currentItem = this._getCurrentItemByHash();
    if (currentItem) {
      util.triggerEvent(currentItem.element, 'click');
    }

    setInterval(() => {
      this._doAnim();
    }, this.data.forceInterval);

    if (!this.data.isSmartPhone) {
      window.addEventListener('resize', () => {
        if (!this.groupItems()) {
          return;
        }
        this._resetTranslate();
        this._setPosByCurrentIndex();
        this._setSizeByScreen();
        this.update();
      });

      window.addEventListener('keydown', (e) => {
        const code = e.keyCode || e.which;
        if (this.data.hide === true) {
          return;
        }
        if (code === 37) {
          this.gotoSlide(this.data.prev);
        } else if (code === 39) {
          this.gotoSlide(this.data.next);
        } else if (code === 27) {
          this.hidePhoto();
        }
      });
      return;
    }

    window.addEventListener('orientationchange', () => {
      if (!this.groupItems()) {
        return;
      }
      this._resetTranslate();
      this._setPosByCurrentIndex();
      this._setHashByCurrentIndex();
      this._setSizeByScreen();
      this.update();
    });

    if (!this.data.useOrientationApi) {
      return;
    }

    window.addEventListener('deviceorientation', (e) => {
      const { orientation } = window;
      if (!e || !e.gamma || this.data.appearEffect) {
        return;
      }
      if (!this.isBeingZoomed && !this.photoSwipable && !this.data.elastic && this.data.scale) {
        if (orientation === 0) {
          this._calcGravity(e.gamma, e.beta);
        } else if (orientation === 90) {
          this._calcGravity(e.beta, e.gamma);
        } else if (orientation === -90) {
          this._calcGravity(-e.beta, -e.gamma);
        } else if (orientation === 180) {
          this._calcGravity(-e.gamma, -e.beta);
        }
      }
    });
  }

  on(event, fn) {
    const photo = this._getElementByClass(this.data.classNames.smartPhoto);
    photo.addEventListener(event, (e) => {
      fn.call(this, e);
    });
  }

  increment(item) {
    return item + 1;
  }

  round(number) {
    return Math.round(number);
  }

  virtualPos(pos) {
    pos = parseInt(pos, 10);
    const item = this._getSelectedItem();
    return pos / item.scale / this.data.scaleSize;
  }

  groupItems() {
    return this.data.group[this.data.currentGroup];
  }

  _resetTranslate() {
    const items = this.groupItems();
    items.forEach((item, index) => {
      item.translateX = this._getWindowWidth() * index;
    });
  }

  addNewItem(element) {
    const groupId = element.getAttribute('data-group') || 'nogroup';
    const { group } = this.data;
    if (groupId === 'nogroup') {
      element.setAttribute('data-group', 'nogroup');
    }
    if (!group[groupId]) {
      group[groupId] = [];
    }
    const index = group[groupId].length;
    const body = document.querySelector('body');
    const src = element.getAttribute('href');
    const img = element.querySelector('img');
    let thumb = src;
    if (img) {
      if (img.currentSrc) {
        thumb = img.currentSrc;
      } else {
        thumb = img.src;
      }
    }
    const item = {
      src,
      thumb,
      caption: element.getAttribute('data-caption'),
      groupId,
      translateX: this._getWindowWidth() * index,
      index,
      translateY: 0,
      width: 50,
      height: 50,
      id: element.getAttribute('data-id') || index,
      loaded: false,
      processed: false,
      element
    };
    group[groupId].push(item);
    this.data.currentGroup = groupId;
    const id = element.getAttribute('data-id');
    if (!id) {
      element.setAttribute('data-id', index);
    }
    element.setAttribute('data-index', index);
    element.addEventListener('click', (event) => {
      event.preventDefault();
      this.data.currentGroup = element.getAttribute('data-group');
      this.data.currentIndex = parseInt(element.getAttribute('data-index'), 10);
      this._setHashByCurrentIndex();
      const currentItem = this._getSelectedItem();
      if (currentItem.loaded) {
        this._initPhoto();
        this.addAppearEffect(element, currentItem);
        this.clicked = true;
        this.update();
        body.style.overflow = 'hidden';
        this._fireEvent('open');
      } else {
        this._loadItem(currentItem).then(() => {
          this._initPhoto();
          this.addAppearEffect(element, currentItem);
          this.clicked = true;
          this.update();
          body.style.overflow = 'hidden';
          this._fireEvent('open');
        });
      }
    });
  }

  _initPhoto() {
    this.data.total = this.groupItems().length;
    this.data.hide = false;
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this._setPosByCurrentIndex();
    this._setSizeByScreen();
    this.setArrow();
    if (this.data.resizeStyle === 'fill' && this.data.isSmartPhone) {
      this.data.scale = true;
      this.data.hideUi = true;
      this.data.scaleSize = this._getScaleBoarder();
    }
  }

  onUpdated() {
    if (this.data.appearEffect && this.data.appearEffect.once) {
      this.data.appearEffect.once = false;
      this.execEffect().then(() => {
        this.data.appearEffect = null;
        this.data.appear = true;
        this.update();
      });
    }
    if (this.clicked) {
      this.clicked = false;
      const { classNames } = this.data;
      const caption = this._getElementByClass(classNames.smartPhotoCaption);
      caption.focus();
    }
  }

  execEffect() {
    return new Promise((resolve) => {
      if (util.isOldIE()) {
        resolve();
      }
      const { appearEffect, classNames } = this.data;
      const effect = this._getElementByClass(classNames.smartPhotoImgClone);
      const handler = () => {
        effect.removeEventListener('transitionend', handler, true);
        resolve();
      };
      effect.addEventListener('transitionend', handler, true);
      setTimeout(() => {
        effect.style.transform = `translate(${appearEffect.afterX}px, ${appearEffect.afterY}px) scale(${appearEffect.scale})`;
      }, 10);
    });
  }

  addAppearEffect(element, item) {
    if (this.data.showAnimation === false) {
      this.data.appear = true;
      return;
    }
    const img = element.querySelector('img');
    const pos = util.getViewPos(img);
    const appear = {};
    let scale = 1;
    appear.width = img.offsetWidth;
    appear.height = img.offsetHeight;
    appear.top = pos.top;
    appear.left = pos.left;
    appear.once = true;
    appear.img = item.src;
    const toX = this._getWindowWidth();
    const toY = this._getWindowHeight();
    const screenY = toY - this.data.headerHeight - this.data.footerHeight;

    if (this.data.resizeStyle === 'fill' && this.data.isSmartPhone) {
      if (img.offsetWidth > img.offsetHeight) {
        scale = toY / img.offsetHeight;
      } else {
        scale = toX / img.offsetWidth;
      }
    } else {
      if (appear.width >= appear.height) {
        if (item.height < screenY) {
          scale = item.width / appear.width;
        } else {
          scale = screenY / appear.height;
        }
      } else if (appear.height > appear.width) {
        if (item.height < screenY) {
          scale = item.height / appear.height;
        } else {
          scale = screenY / appear.height;
        }
      }
      if (appear.width * scale > toX) {
        scale = toX / appear.width;
      }
    }

    const x = (scale - 1) / 2 * img.offsetWidth + (toX - (img.offsetWidth * scale)) / 2;
    const y = (scale - 1) / 2 * img.offsetHeight + (toY - (img.offsetHeight * scale)) / 2;
    appear.afterX = x;
    appear.afterY = y;
    appear.scale = scale;
    this.data.appearEffect = appear;
  }

  hidePhoto(dir = 'bottom') {
    this.data.hide = true;
    this.data.appear = false;
    this.data.appearEffect = null;
    this.data.hideUi = false;
    this.data.scale = false;
    this.data.scaleSize = 1;
    const scrollX = (window.pageXOffset !== undefined) ? window.pageXOffset : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
    const scrollY = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
    const body = document.querySelector('body');
    if (window.location.hash) {
      this._setHash('');
    }
    window.scroll(scrollX, scrollY);
    this._doHideEffect(dir).then(() => {
      this.update();
      body.style.overflow = '';
      this._fireEvent('close');
    });
  }

  _doHideEffect(dir) {
    return new Promise((resolve) => {
      if (util.isOldIE()) {
        resolve();
      }
      const { classNames } = this.data;
      const photo = this._getElementByClass(classNames.smartPhoto);
      const img = this._getElementByQuery(`.current .${classNames.smartPhotoImg}`);
      const height = this._getWindowHeight();
      const handler = () => {
        photo.removeEventListener('transitionend', handler, true);
        resolve();
      };
      photo.style.opacity = 0;
      if (dir === 'bottom') {
        img.style.transform = `translateY(${height}px)`;
      } else if (dir === 'top') {
        img.style.transform = `translateY(-${height}px)`;
      }
      photo.addEventListener('transitionend', handler, true);
    });
  }

  _getElementByClass(className) {
    return document.querySelector(`[data-id="${this.id}"] .${className}`);
  }

  _getElementByQuery(query) {
    return document.querySelector(`[data-id="${this.id}"] ${query}`);
  }

  _getTouchPos() {
    let x = 0;
    let y = 0;
    const e = typeof event === 'undefined' ? this.e : event;
    if (this._isTouched(e)) {
      x = e.touches[0].pageX;
      y = e.touches[0].pageY;
    } else if (e.pageX) {
      x = e.pageX;
      y = e.pageY;
    }
    return { x, y };
  }

  _getGesturePos(e) {
    const touches = e.touches;
    return [
      { x: touches[0].pageX, y: touches[0].pageY },
      { x: touches[1].pageX, y: touches[1].pageY }
    ];
  }

  _setPosByCurrentIndex() {
    const items = this.groupItems();
    const moveX = -1 * items[this.data.currentIndex].translateX;
    this.pos.x = moveX;
    setTimeout(() => {
      this.data.translateX = moveX;
      this.data.translateY = 0;
      this._listUpdate();
    }, 1);
  }

  _setHashByCurrentIndex() {
    const scrollX = (window.pageXOffset !== undefined) ? window.pageXOffset : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
    const scrollY = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
    const items = this.groupItems();
    const id = items[this.data.currentIndex].id;
    const group = this.data.currentGroup;
    const hash = `group=${group}&photo=${id}`;
    this._setHash(hash);
    window.scroll(scrollX, scrollY);
  }

  _setHash(hash) {
    if (!(window.history && window.history.pushState) || !this.data.useHistoryApi) {
      return;
    }
    if (hash) {
      window.history.replaceState(null, null, `${location.pathname}${location.search}#${hash}`);
    } else {
      window.history.replaceState(null, null, `${location.pathname}${location.search}`);
    }
  }

  _getCurrentItemByHash() {
    const group = this.data.group;
    const hash = location.hash.substr(1);
    const hashObj = util.parseQuery(hash);
    let currentItem = null;
    const getCurrentItem = (item) => {
      if (hashObj.group === item.groupId && hashObj.photo === item.id) {
        currentItem = item;
      }
    };
    Object.keys(group).forEach((key) => {
      group[key].forEach(getCurrentItem);
    });
    return currentItem;
  }

  _loadItem(item) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        item.width = img.width;
        item.height = img.height;
        item.loaded = true;
        resolve();
      };
      img.onerror = () => {
        resolve();
      };
      img.src = item.src;
    });
  }

  _getItemByIndex(index) {
    const { data } = this;
    if (data.group[data.currentGroup][index]) {
      return data.group[data.currentGroup][index];
    } else {
      return null;
    }
  }

  _loadNeighborItems() {
    const index = this.data.currentIndex;
    const { loadOffset } = this.data;
    const from = index - loadOffset;
    const to = index + loadOffset;
    const promises = [];
    for (let i = from; i < to; i++) {
      const item = this._getItemByIndex(i);
      if (item && !item.loaded) {
        promises.push(this._loadItem(item));
      }
    }
    if (promises.length) {
      Promise.all(promises).then(() => {
        this._initPhoto();
        this.update();
      });
    }
  }

  _setSizeByScreen() {
    const windowX = this._getWindowWidth();
    const windowY = this._getWindowHeight();
    const headerHeight = this.data.headerHeight;
    const footerHeight = this.data.footerHeight;
    const screenY = windowY - (headerHeight + footerHeight);
    const items = this.groupItems();
    items.forEach((item) => {
      if (!item.loaded) {
        return;
      }
      item.processed = true;
      item.scale = screenY / item.height;
      if (item.height < screenY) {
        item.scale = 1;
      }
      item.x = (item.scale - 1) / 2 * item.width + (windowX - (item.width * item.scale)) / 2;
      item.y = (item.scale - 1) / 2 * item.height + (windowY - (item.height * item.scale)) / 2;
      if (item.width * item.scale > windowX) {
        item.scale = windowX / item.width;
        item.x = (item.scale - 1) / 2 * item.width;
      }
    });
  }

  _slideList() {
    this.data.scaleSize = 1;
    this.isBeingZoomed = false;
    this.data.hideUi = false;
    this.data.scale = false;
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this.data.onMoveClass = true;
    this._setPosByCurrentIndex();
    this._setHashByCurrentIndex();
    this._setSizeByScreen();
    setTimeout(() => {
      const item = this._getSelectedItem();
      this.data.onMoveClass = false;
      this.setArrow();
      this.update();
      if (this.data.oldIndex !== this.data.currentIndex) {
        this._fireEvent('change');
      }
      this.data.oldIndex = this.data.currentIndex;
      this._loadNeighborItems();
      if (!item.loaded) {
        this._loadItem(item).then(() => {
          this._initPhoto();
          this.update();
        });
      }
    }, 200);
  }

  gotoSlide(index) {
    if (this.e && this.e.preventDefault) {
      this.e.preventDefault();
    }
    this.data.currentIndex = parseInt(index, 10);
    if (!this.data.currentIndex) {
      this.data.currentIndex = 0;
    }
    this._slideList();
  }

  setArrow() {
    const items = this.groupItems();
    const length = items.length;
    const next = this.data.currentIndex + 1;
    const prev = this.data.currentIndex - 1;
    this.data.showNextArrow = false;
    this.data.showPrevArrow = false;
    if (next !== length) {
      this.data.next = next;
      this.data.showNextArrow = true;
    }
    if (prev !== -1) {
      this.data.prev = prev;
      this.data.showPrevArrow = true;
    }
  }

  beforeDrag() {
    if (this._isGestured(this.e)) {
      this.beforeGesture();
      return;
    }
    this.isBeingZoomed = false;
    if (this.data.scale) {
      this.beforePhotoDrag();
      return;
    }
    const pos = this._getTouchPos();
    this.isSwipable = true;
    this.dragStart = true;
    this.firstPos = pos;
    this.oldPos = pos;
  }

  afterDrag() {
    const items = this.groupItems();
    const date = new Date();
    const tapSecond = date.getTime();
    const offset = this.tapSecond - tapSecond;
    let swipeWidth = 0;
    let swipeHeight = 0;
    this.isSwipable = false;
    this.onListMove = false;

    if (this.oldPos) {
      swipeWidth = this.oldPos.x - this.firstPos.x;
      swipeHeight = this.oldPos.y - this.firstPos.y;
    }
    if (this.isBeingZoomed) {
      this.afterGesture();
      return;
    }
    if (this.data.scale) {
      this.afterPhotoDrag();
      return;
    } else if (!util.isSmartPhone() && swipeWidth === 0 && swipeHeight === 0) {
      this.zoomPhoto();
      return;
    }
    if (Math.abs(offset) <= 500 && swipeWidth === 0 && swipeHeight === 0) {
      this.e.preventDefault();
      this.zoomPhoto();
      return;
    }
    this.tapSecond = tapSecond;
    this._fireEvent('swipeend');
    if (this.moveDir === 'horizontal') {
      if (swipeWidth >= this.data.swipeOffset && this.data.currentIndex !== 0) {
        this.data.currentIndex -= 1;
      } else if (swipeWidth <= -this.data.swipeOffset && this.data.currentIndex !== items.length - 1) {
        this.data.currentIndex += 1;
      }
      this._slideList();
    }
    if (this.moveDir === 'vertical') {
      if (this.data.swipeBottomToClose && swipeHeight >= this.data.swipeOffset) {
        this.hidePhoto('bottom');
      } else if (this.data.swipeTopToClose && swipeHeight <= -this.data.swipeOffset) {
        this.hidePhoto('top');
      } else {
        this.data.translateY = 0;
        this._slideList();
      }
    }
  }

  onDrag() {
    this.e.preventDefault();
    if (this._isGestured(this.e) && this.onListMove === false) {
      this.onGesture();
      return;
    }
    if (this.isBeingZoomed) {
      return;
    }
    if (this.data.scale) {
      this.onPhotoDrag();
      return;
    }
    if (!this.isSwipable) {
      return;
    }

    const pos = this._getTouchPos();
    const x = pos.x - this.oldPos.x;
    const y = pos.y - this.firstPos.y;

    if (this.dragStart) {
      this._fireEvent('swipestart');
      this.dragStart = false;
      if (Math.abs(x) > Math.abs(y)) {
        this.moveDir = 'horizontal';
      } else {
        this.moveDir = 'vertical';
      }
    }

    if (this.moveDir === 'horizontal') {
      this.pos.x += x;
      this.data.translateX = this.pos.x;
    } else {
      this.data.translateY = y;
    }
    this.onListMove = true;
    this.oldPos = pos;
    this._listUpdate();
  }

  zoomPhoto() {
    this.data.hideUi = true;
    this.data.scaleSize = this._getScaleBoarder();
    if (this.data.scaleSize <= 1) {
      return;
    }
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this._photoUpdate();
    setTimeout(() => {
      this.data.scale = true;
      this._photoUpdate();
      this._fireEvent('zoomin');
    }, 300);
  }

  zoomOutPhoto() {
    this.data.scaleSize = 1;
    this.isBeingZoomed = false;
    this.data.hideUi = false;
    this.data.scale = false;
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this._photoUpdate();
    this._fireEvent('zoomout');
  }

  beforePhotoDrag() {
    const pos = this._getTouchPos();
    this.photoSwipable = true;
    if (!this.data.photoPosX) {
      this.data.photoPosX = 0;
    }
    if (!this.data.photoPosY) {
      this.data.photoPosY = 0;
    }
    this.oldPhotoPos = pos;
    this.firstPhotoPos = pos;
  }

  onPhotoDrag() {
    if (!this.photoSwipable) {
      return;
    }
    this.e.preventDefault();
    const pos = this._getTouchPos();
    const x = pos.x - this.oldPhotoPos.x;
    const y = pos.y - this.oldPhotoPos.y;
    const moveX = this._round(this.data.scaleSize * x, 6);
    const moveY = this._round(this.data.scaleSize * y, 6);
    if (typeof moveX === 'number') {
      this.data.photoPosX += moveX;
      this.photoVX = moveX;
    }
    if (typeof moveY === 'number') {
      this.data.photoPosY += moveY;
      this.photoVY = moveY;
    }
    this.oldPhotoPos = pos;
    this._photoUpdate();
  }

  afterPhotoDrag() {
    if (this.oldPhotoPos.x === this.firstPhotoPos.x && this.photoSwipable) {
      this.photoSwipable = false;
      this.zoomOutPhoto();
    } else {
      this.photoSwipable = false;
      const item = this._getSelectedItem();
      const bound = this._makeBound(item);
      const offset = this.data.swipeOffset * this.data.scaleSize;
      let flagX = 0;
      let flagY = 0;
      if (this.data.photoPosX > bound.maxX) {
        flagX = -1;
      } else if (this.data.photoPosX < bound.minX) {
        flagX = 1;
      }
      if (this.data.photoPosY > bound.maxY) {
        flagY = -1;
      } else if (this.data.photoPosY < bound.minY) {
        flagY = 1;
      }

      if (this.data.photoPosX - bound.maxX > offset && this.data.currentIndex !== 0) {
        this.gotoSlide(this.data.prev);
        return;
      }

      if (bound.minX - this.data.photoPosX > offset && this.data.currentIndex + 1 !== this.data.total) {
        this.gotoSlide(this.data.next);
        return;
      }

      // todo
      // if(this.data.photoPosY - bound.maxY > offset) {
      //   this.hidePhoto();
      //   return;
      // }

      if (flagX === 0 && flagY === 0) {
        this.vx = this.photoVX / 5;
        this.vy = this.photoVY / 5;
      } else {
        this._registerElasticForce(flagX, flagY);
      }
    }
  }

  beforeGesture() {
    this._fireEvent('gesturestart');
    const pos = this._getGesturePos(this.e);
    const distance = this._getDistance(pos[0], pos[1]);
    this.isBeingZoomed = true;
    this.oldDistance = distance;
    this.data.scale = true;
    this.e.preventDefault();
  }

  onGesture() {
    const pos = this._getGesturePos(this.e);
    const distance = this._getDistance(pos[0], pos[1]);
    const size = (distance - this.oldDistance) / 100;
    const oldScaleSize = this.data.scaleSize;
    const posX = this.data.photoPosX;
    const posY = this.data.photoPosY;
    this.isBeingZoomed = true;
    this.data.scaleSize += this._round(size, 6);
    if (this.data.scaleSize < 0.2) {
      this.data.scaleSize = 0.2;
    }
    // todo
    if (this.data.scaleSize < oldScaleSize) {
      this.data.photoPosX = (1 + this.data.scaleSize - oldScaleSize) * posX;
      this.data.photoPosY = (1 + this.data.scaleSize - oldScaleSize) * posY;
    }

    if (this.data.scaleSize < 1 || this.data.scaleSize > this._getScaleBoarder()) {
      this.data.hideUi = true;
    } else {
      this.data.hideUi = false;
    }
    this.oldDistance = distance;
    this.e.preventDefault();
    this._photoUpdate();
  }

  afterGesture() {
    if (this.data.scaleSize > this._getScaleBoarder()) {
      return;
    }
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this.data.scale = false;
    this.data.scaleSize = 1;
    this.data.hideUi = false;
    this._fireEvent('gestureend');
    this._photoUpdate();
  }

  _getForceAndTheta(vx, vy) {
    return {
      force: Math.sqrt((vx * vx) + (vy * vy)),
      theta: Math.atan2(vy, vx)
    };
  }

  _getScaleBoarder() {
    const item = this._getSelectedItem();
    const windowWidth = this._getWindowWidth();
    const windowHeight = this._getWindowHeight();
    if (!util.isSmartPhone()) {
      return 1 / item.scale;
    }
    if (item.width > item.height) {
      return windowHeight / (item.height * item.scale);
    }
    return windowWidth / (item.width * item.scale);
  }

  _makeBound(item) {
    const width = item.width * item.scale * this.data.scaleSize;
    const height = item.height * item.scale * this.data.scaleSize;
    let minX;
    let minY;
    let maxX;
    let maxY;
    const windowWidth = this._getWindowWidth();
    const windowHeight = this._getWindowHeight();
    if (windowWidth > width) {
      maxX = (windowWidth - width) / 2;
      minX = -1 * maxX;
    } else {
      maxX = (width - windowWidth) / 2;
      minX = -1 * maxX;
    }
    if (windowHeight > height) {
      maxY = (windowHeight - height) / 2;
      minY = -1 * maxY;
    } else {
      maxY = (height - windowHeight) / 2;
      minY = -1 * maxY;
    }
    return {
      minX: this._round(minX, 6) * this.data.scaleSize,
      minY: this._round(minY, 6) * this.data.scaleSize,
      maxX: this._round(maxX, 6) * this.data.scaleSize,
      maxY: this._round(maxY, 6) * this.data.scaleSize
    };
  }

  _registerElasticForce(x, y) {
    const item = this._getSelectedItem();
    const bound = this._makeBound(item);
    this.data.elastic = true;
    if (x === 1) {
      this.data.photoPosX = bound.minX;
    } else if (x === -1) {
      this.data.photoPosX = bound.maxX;
    }
    if (y === 1) {
      this.data.photoPosY = bound.minY;
    } else if (y === -1) {
      this.data.photoPosY = bound.maxY;
    }
    this._photoUpdate();
    setTimeout(() => {
      this.data.elastic = false;
      this._photoUpdate();
    }, 300);
  }

  _getSelectedItem() {
    const data = this.data;
    const index = data.currentIndex;
    return data.group[data.currentGroup][index];
  }

  _getUniqId() {
    return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
  }

  _getDistance(point1, point2) {
    const x = point1.x - point2.x;
    const y = point1.y - point2.y;
    return Math.sqrt((x * x) + (y * y));
  }

  _round(val, precision) {
    const digit = Math.pow(10, precision);
    val *= digit;
    val = Math.round(val);
    val /= digit;
    return val;
  }

  _isTouched(e) {
    if (e && e.touches) {
      return true;
    }
    return false;
  }

  _isGestured(e) {
    if (e && e.touches && e.touches.length > 1) {
      return true;
    }
    return false;
  }

  _isSmartPhone() {
    const agent = navigator.userAgent;
    if (agent.indexOf('iPhone') > 0 || agent.indexOf('iPad') > 0
        || agent.indexOf('ipod') > 0 || agent.indexOf('Android') > 0) {
      return true;
    }
    return false;
  }

  _calcGravity(gamma, beta) {
    if (gamma > 5 || gamma < -5) {
      this.vx += gamma * 0.05;
    }
    if (this.data.verticalGravity === false) {
      return;
    }
    if (beta > 5 || beta < -5) {
      this.vy += beta * 0.05;
    }
  }

  _photoUpdate() {
    const classNames = this.data.classNames;
    const current = this._getElementByQuery('.current');
    const img = current.querySelector(`.${classNames.smartPhotoImg}`);
    const nav = this._getElementByQuery(`.${classNames.smartPhotoNav}`);
    const arrows = this._getElementByQuery(`.${classNames.smartPhotoArrows}`);
    const photoPosX = this.virtualPos(this.data.photoPosX);
    const photoPosY = this.virtualPos(this.data.photoPosY);
    const scaleSize = this.data.scaleSize;
    const transform = `translate(${photoPosX}px,${photoPosY}px) scale(${scaleSize})`;

    img.style.transform = transform;
    if (this.data.scale) {
      util.addClass(img, classNames.smartPhotoImgOnMove);
    } else {
      util.removeClass(img, classNames.smartPhotoImgOnMove);
    }
    if (this.data.elastic) {
      util.addClass(img, classNames.smartPhotoImgElasticMove);
    } else {
      util.removeClass(img, classNames.smartPhotoImgElasticMove);
    }
    if (this.data.hideUi) {
      if (nav) {
        nav.setAttribute('aria-hidden', 'true');
      }
      if (arrows) {
        arrows.setAttribute('aria-hidden', 'true');
      }
    } else {
      if (nav) {
        nav.setAttribute('aria-hidden', 'false');
      }
      if (arrows) {
        arrows.setAttribute('aria-hidden', 'false');
      }
    }
  }

  _getWindowWidth() {
    if (document && document.documentElement) {
      return document.documentElement.clientWidth;
    } else if (window && window.innerWidth) {
      return window.innerWidth;
    }
    return 0;
  }

  _getWindowHeight() {
    if (document && document.documentElement) {
      return document.documentElement.clientHeight;
    } else if (window && window.innerHeight) {
      return window.innerHeight;
    }
    return 0;
  }

  _listUpdate() {
    const classNames = this.data.classNames;
    const list = this._getElementByQuery(`.${classNames.smartPhotoList}`);
    const transform = `translate(${this.data.translateX}px,${this.data.translateY}px)`;
    list.style.transform = transform;
    // $list
    if (this.data.onMoveClass) {
      util.addClass(list, classNames.smartPhotoListOnMove);
    } else {
      util.removeClass(list, classNames.smartPhotoListOnMove);
    }
  }

  _fireEvent(eventName) {
    const photo = this._getElementByClass(this.data.classNames.smartPhoto);
    util.triggerEvent(photo, eventName);
  }

  _doAnim() {
    if (this.isBeingZoomed ||
        this.isSwipable ||
        this.photoSwipable ||
        this.data.elastic ||
        !this.data.scale
    ) {
      return;
    }
    this.data.photoPosX += this.vx;
    this.data.photoPosY += this.vy;
    const item = this._getSelectedItem();
    const bound = this._makeBound(item);
    if (this.data.photoPosX < bound.minX) {
      this.data.photoPosX = bound.minX;
      this.vx *= -0.2;
    } else if (this.data.photoPosX > bound.maxX) {
      this.data.photoPosX = bound.maxX;
      this.vx *= -0.2;
    }
    if (this.data.photoPosY < bound.minY) {
      this.data.photoPosY = bound.minY;
      this.vy *= -0.2;
    } else if (this.data.photoPosY > bound.maxY) {
      this.data.photoPosY = bound.maxY;
      this.vy *= -0.2;
    }
    const power = this._getForceAndTheta(this.vx, this.vy);
    let force = power.force;
    const theta = power.theta;
    force -= this.data.registance;
    if (Math.abs(force) < 0.5) {
      return;
    }
    this.vx = Math.cos(theta) * force;
    this.vy = Math.sin(theta) * force;
    this._photoUpdate();
  }

}
