import aTemplate from 'a-template';
import template from './viwer.html';
const util = require('../lib/util');

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
  arrows:true,
  nav:true,
  animationSpeed: 300,
  swipeOffset: 100,
  maxWidth: 940,
  headerHeight:60,
  footerHeight:60,
  forceInterval:10,
  registance:0.5,
  resizeStyle:'fill',
  verticalGravity:false,
  useOrientationApi:true
}

class smartPhoto extends aTemplate {

  constructor (selector, settings) {
    super();

    this.data = util.extend({},defaults,settings);
    this.data.currentIndex = 0;
    this.data.hide = true;
    this.data.group = {};
    this.data.scaleSize = 1;
    this.data.scale = false;
    this.pos = { x: 0, y: 0};
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this.convert = {
      increment:this.increment,
      virtualPos:this.virtualPos
    };
    this.data.groupItems = this.groupItems;
    this.elements = document.querySelectorAll(selector);
    const date = new Date();
    this.tapSecond = date.getTime();
    this.onListMove = false;
    this.id = this._getUniqId();
    this.vx = 0;
    this.vy = 0;
    this.data.appearEffect = null;
    this.addTemplate(this.id,template);
    this.data.isSmartPhone = this._isSmartPhone();
    const body = document.querySelector('body');
    util.append(body,`<div data-id='${this.id}'></div>`);
    [].forEach.call(this.elements, (element,index) => {
      this.addNewItem(element);
    });

    const currentItem = this._getCurrentItemByHash();
    if(currentItem) {
      util.triggerEvent(currentItem.element,'click');
    }

    this._getEachImageSize();

    setInterval(()=>{
      this._doAnim();
    },this.data.forceInterval);

    if(!this.data.isSmartPhone){
      window.addEventListener("resize", (e) => {
        this._resetTranslate();
        this._setPosByCurrentIndex();
        this._setSizeByScreen();
        this.update();
      });

      window.addEventListener('keydown', (e) => {
        const code = e.keyCode || e.which;
        if(this.data.hide === true) {
          return;
        }
        if(code === 37) {
          this.gotoSlide(this.data.prev);
        } else if (code === 39) {
          this.gotoSlide(this.data.next);
        } else if (code === 27) {
          this.hidePhoto();
        }
      });
      return;
    }

    window.addEventListener("orientationchange", (e) => {
      this._resetTranslate();
      this._setPosByCurrentIndex();
      this._setHashByCurrentIndex();
      this._setSizeByScreen();
      this.update();
    });

    if(!this.data.useOrientationApi){
      return;
    }

    window.addEventListener("deviceorientation", (e) => {
      const orientation = window.orientation;
      if(!e || !e.gamma || this.data.appearEffect){
        return;
      }
      if(!this.isBeingZoomed && !this.photoSwipable && !this.data.elastic && this.data.scale){
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

  increment (item) {
    return item+1;
  }

  virtualPos (pos) {
    pos = parseInt(pos);
    const item = this._getSelectedItem();
    return pos/item.scale/this.data.scaleSize;
  }

  groupItems () {
    return this.data.group[this.data.currentGroup];
  }

  _getEachImageSize () {
    const arr = [];
    const group = this.data.group;
    for (let i in group){
      if (!group.hasOwnProperty(i)){
        continue;
      }
      group[i].forEach((item) => {
        const promise = new Promise((resolve,reject) => {
          const img = new Image();
          img.onload = () => {
            item.width = img.width;
            item.height = img.height;
            item.loaded = true;
            resolve();
          }
          img.onerror = () => {
            resolve();
          }
          img.src = item.src;
        });
        arr.push(promise);
      });
    }
    return Promise.all(arr);
  }

  _resetTranslate () {
    const items = this.groupItems();
    items.forEach((item,index) => {
      item.translateX = window.innerWidth * index;
    });
  }

  addNewItem (element) {
    let groupId = element.getAttribute('data-group') || "nogroup";
    const group = this.data.group;
    if(groupId === "nogroup"){
      element.setAttribute("data-group","nogroup");
    }
    if(!group[groupId]) {
      group[groupId] = [];
    }
    const index = group[groupId].length;
    const item = {
      src: element.getAttribute('href'),
      caption: element.getAttribute('data-caption'),
      groupId: groupId,
      translateX: window.innerWidth * index,
      index: index,
      translateY:0,
      width:50,
      height:50,
      id: element.getAttribute('data-id') || index,
      loaded:false,
      element:element
    };
    group[groupId].push(item);
    this.data.currentGroup = groupId;
    let id = element.getAttribute('data-id');
    if(!id){
      element.setAttribute('data-id',index);
    }
    element.setAttribute('data-index',index);
    element.addEventListener('click', (event) => {
      event.preventDefault();
      this.data.currentGroup = element.getAttribute('data-group');
      this.data.currentIndex = parseInt(element.getAttribute('data-index'));
      this._setHashByCurrentIndex();
      const currentItem = this._getSelectedItem();
      if(currentItem.loaded) {
        this._initPhoto();
        this.addAppearEffect(element);
        this.update();
      } else {
        this._loadItem(currentItem).then(() => {
          this.data.appear = true;
          this._initPhoto();
          this.update();
        });
      }
    });
  }

  _initPhoto () {
    this.data.total = this.groupItems().length;
    this.data.hide = false;
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;  
    this._setPosByCurrentIndex();  
    this._setSizeByScreen();
    this.setArrow(); 
    if(this.data.resizeStyle === 'fill' && this.data.isSmartPhone){
      this.data.scale = true;
      this.data.hideUi = true;
      this.data.scaleSize = this._getScaleBoarder();
    }
  }

  onUpdated () {
    if(this.data.appearEffect && this.data.appearEffect.once) {
      this.data.appearEffect.once = false;
      this.execEffect().then(() => {
        this.replaceEffectWithImg();
      });
    }
  }

  execEffect () {
    const appearEffect = this.data.appearEffect;
    const classNames = this.data.classNames;
    const effect = document.querySelector(`[data-id="${this.id}"] .${classNames.smartPhotoImgClone}`);
    return new Promise((resolve,reject) => {
      setTimeout(()=>{
        effect.style.transition = 'all .3s ease-out';
        effect.style.transform = `translate(${appearEffect.afterX}px, ${appearEffect.afterY}px) scale(${appearEffect.scale})`;
        resolve();
      },30);
    });
  }

  replaceEffectWithImg () {
    const classNames = this.data.classNames;
    setTimeout(()=>{
      this.data.appearEffect = null;
      this.data.appear = true;
      this.update();
    },300);  
  }

  addAppearEffect (element) {
    const img = element.querySelector('img');
    const clone = img.cloneNode(true);
    const pos = util.getViewPos(img);
    const appear = {};
    let scale = 1;
    appear.width = img.offsetWidth;
    appear.height = img.offsetHeight;
    appear.top = pos.top;
    appear.left = pos.left;
    appear.once = true;
    appear.img = img.getAttribute('src');  
    const windowX = window.innerWidth;
    const windowY = window.innerHeight;
    const screenY = windowY - this.data.headerHeight - this.data.footerHeight;
    if(this.data.resizeStyle === 'fill' && this.data.isSmartPhone){
      if(img.offsetWidth > img.offsetHeight) {
        scale = windowY / img.offsetHeight;
      }else {
        scale = windowX / img.offsetWidth;
      }
    }else{
      scale = screenY / img.offsetHeight;
      if(scale*img.offsetWidth > windowX) {
        scale = windowX / img.offsetWidth;
      }
    }
    const x = (scale - 1) / 2 * img.offsetWidth + (windowX - (img.offsetWidth *scale)) / 2;
    const y = (scale - 1) / 2 * img.offsetHeight + (windowY - (img.offsetHeight *scale)) / 2;
    appear.afterX = x;
    appear.afterY = y;
    appear.scale = scale;
    this.data.appearEffect = appear;
  }

  hidePhoto () {
    this.data.hide = true;
    this.data.appear = false;
    this.data.appearEffect = null;
    this.data.hideUi = false;
    this.data.scale = false;
    this.data.scaleSize = 1;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    if (location.hash) {
      location.hash = "";
    }
    window.scroll(scrollX,scrollY);
    this._doHideEffect().then(() => {
      this.update();
    });
  }

  _doHideEffect () {
    return new Promise((resolve,reject) => {
      const classNames = this.data.classNames;
      const photo = this._getElementByClass(classNames.smartPhoto);
      const img = this._getElementByQuery(`.current .${classNames.smartPhotoImg}`);
      const height = window.innerHeight;
      const handler = () => {
        photo.removeEventListener('transitionend', handler, true);
        resolve();
      };
      photo.style.opacity = 0;
      img.style.transform = `translateY(${height}px)`;
      photo.addEventListener('transitionend',  handler, true); 
    });
  }

  _getElementByClass (className) {
    return document.querySelector(`[data-id="${this.id}"] .${className}`);
  }

  _getElementByQuery (query) {
    return document.querySelector(`[data-id="${this.id}"] ${query}`);
  }

  _getTouchPos (e) {
    let x = 0;
    let y = 0;
    if (typeof event === 'undefined'){
      var event = this.e;
    }
    if (this._isTouched(event)) {
      x = event.touches[0].pageX;
      y = event.touches[0].pageY;
    } else if (this._isTouched(this.e)) {
      x = this.e.touches[0].pageX;
      y = this.e.touches[0].pageY;
    } else if(event.pageX){
      x = event.pageX;
      y = event.pageY;
    }
    return { x: x, y: y };
  }

  _getGesturePos (e) {
    const touches = e.touches;
     return [
      { x: touches[0].pageX, y: touches[0].pageY},
      { x: touches[1].pageX, y: touches[1].pageY}
    ]
  }

  _setPosByCurrentIndex () {
    const items = this.groupItems();
    const moveX = -1 * items[this.data.currentIndex].translateX;
    this.pos.x = moveX;
    setTimeout(() => {
      this.data.translateX = moveX;
      this.data.translateY = 0;
      this._listUpdate();
    },1);
  }

  _setHashByCurrentIndex () {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const items = this.groupItems();
    const id = items[this.data.currentIndex].id;
    const group = this.data.currentGroup;
    const hash = `group=${group}&photo=${id}`;
    location.hash = hash;
    window.scroll(scrollX,scrollY);
  }

  _getCurrentItemByHash () {
    const group = this.data.group;
    const hash = location.hash.substr(1);
    const hashObj = util.parseQuery(hash);
    let currentItem = null;
    for (let i in group){
      if (!group.hasOwnProperty(i)){
        continue;
      }
      group[i].forEach((item) => {
          if(hashObj.group === item.groupId && hashObj.photo === item.id) {
              currentItem = item;
          }
      });
    }
    return currentItem;
  }

  _loadItem (item) {
    return new Promise ((resolve,reject) => {
      const img = new Image();
      img.onload = () => {
        item.width = img.width;
        item.height = img.height;
        item.loaded = true; 
        resolve(); 
      }
      img.onerror = () => { 
        resolve();
      }
      img.src = item.src;
    });
  }

  _setSizeByScreen () {
    const windowX = window.innerWidth;
    const windowY = window.innerHeight;
    const headerHeight = this.data.headerHeight;
    const footerHeight = this.data.footerHeight;
    const screenY = windowY - (headerHeight + footerHeight);
    const items = this.groupItems();
    items.forEach((item) => {
      item.scale = screenY / item.height;
      item.x = (item.scale - 1) / 2 * item.width + (windowX - (item.width *item.scale)) / 2;
      item.y = (item.scale - 1) / 2 * item.height+ (windowY - (item.height *item.scale)) / 2;
      if(item.width * item.scale > windowX){
        item.scale = windowX / item.width;
        item.x = (item.scale - 1) / 2 * item.width;
      }
    });
  }

  _slideList () {
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
      this.data.onMoveClass = false;
      this.setArrow();
      this.update();
    },200);
  }

  gotoSlide(index) {
    this.data.currentIndex = parseInt(index);
    if(!this.data.currentIndex) {
      this.data.currentIndex = 0;
    }
    this._slideList();
  }

  setArrow(){
    const items = this.groupItems();
    const length = items.length;
    const next = this.data.currentIndex + 1;
    const prev = this.data.currentIndex - 1;
    this.data.showNextArrow = false;
    this.data.showPrevArrow = false;
    if(next !== length) {
      this.data.next = next;
      this.data.showNextArrow = true;
    }
    if(prev !== -1) {
      this.data.prev = prev;
      this.data.showPrevArrow = true;
    }
  }

  beforeDrag () {
    if (this._isGestured(this.e)) {
      this.beforeGesture();
      return;
    }
    if(this.data.scale){
      this.beforePhotoDrag();
      return;
    }
    const pos = this._getTouchPos(this.e);
    this.isSwipable = true;
    this.dragStart = true;
    this.firstPos = pos;
    this.oldPos = pos;
  }

  afterDrag (value) {
    const items = this.groupItems();
    const date = new Date();
    const tapSecond = date.getTime();
    const offset = this.tapSecond - tapSecond;
    let swipeWidth = 0;
    let swipeHeight = 0;
    this.isSwipable = false;
    this.onListMove = false;
    if(this.oldPos) {
      swipeWidth = this.oldPos.x - this.firstPos.x;
      swipeHeight = this.oldPos.y - this.firstPos.y;
    }

    if (this.isBeingZoomed) {
      this.afterGesture();
      return;
    }
    if(this.data.scale){
      this.afterPhotoDrag();
      return;
    } else if (!util.isSmartPhone() && swipeWidth === 0 && swipeHeight === 0) {
      this.zoomPhoto();
      return;
    }
    if(Math.abs(offset) <= 500 && swipeWidth === 0 && swipeHeight === 0) {
      this.e.preventDefault();
      this.zoomPhoto();
      return;
    }
    this.tapSecond = tapSecond;
    if (this.moveDir === 'horizontal') {
      if (swipeWidth >= this.data.swipeOffset && this.data.currentIndex !== 0 ) {
        this.data.currentIndex--;
      } else if (swipeWidth <= - this.data.swipeOffset && this.data.currentIndex != items.length -1 ) {
        this.data.currentIndex++;
      }
      this._slideList();
    }
    if (this.moveDir === 'vertical') {
      if (swipeHeight >= this.data.swipeOffset) {
        this.hidePhoto();
      } else {
        this.data.translateY = 0;
        this._slideList();
      }
    }
  }

  onDrag () {
    this.e.preventDefault();
    if (this._isGestured(this.e) && this.onListMove === false) {
      this.onGesture();
      return;
    }
    if (this.isBeingZoomed) {
      return;
    }
    if(this.data.scale){
      this.onPhotoDrag();
      return;
    }
    if(!this.isSwipable){
      return;
    }

    const pos = this._getTouchPos(this.e);
    const x = pos.x - this.oldPos.x;
    const y = pos.y - this.firstPos.y;

    if (this.dragStart) {
      this.dragStart = false;
      if( Math.abs(x) > Math.abs(y) ) {
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

  zoomPhoto(){
    this.data.hideUi = true;
    this.data.scaleSize =  this._getScaleBoarder();
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this._photoUpdate();
    setTimeout(()=>{
      this.data.scale = true;
      this._photoUpdate();
    },300)
  }

  zoomOutPhoto(){
    this.data.scaleSize = 1;
    this.isBeingZoomed = false;
    this.data.hideUi = false;
    this.data.scale = false;
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this._photoUpdate();
  }

  beforePhotoDrag (){
    const pos = this._getTouchPos(this.e);
    this.photoSwipable = true;
    if(!this.data.photoPosX) {
      this.data.photoPosX = 0;
    }
    if(!this.data.photoPosY) {
      this.data.photoPosY = 0;
    }
    this.oldPhotoPos = pos;
    this.firstPhotoPos = pos;
  }

  onPhotoDrag () {
    if (!this.photoSwipable) {
      return;
    }
    this.e.preventDefault();
    const pos = this._getTouchPos(this.e);
    const x = pos.x - this.oldPhotoPos.x;
    const y = pos.y - this.oldPhotoPos.y;
    let moveX = this._round(this.data.scaleSize*x,6);
    let moveY = this._round(this.data.scaleSize*y,6);
    if(typeof moveX === "number") {
      this.data.photoPosX += moveX;
      this.photoVX = moveX;
    }
    if(typeof moveY === "number"){
      this.data.photoPosY += moveY;
      this.photoVY = moveY;
    }
    this.oldPhotoPos = pos;
    this._photoUpdate();
  }

  afterPhotoDrag () {
    if(this.oldPhotoPos.x === this.firstPhotoPos.x && this.photoSwipable) {
      this.zoomOutPhoto();
    }else{
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
      //test
      if (this.data.photoPosX - bound.maxX > offset && this.data.currentIndex !== 0) {
        this.gotoSlide(this.data.prev);
        return;
      }
      
      if (bound.minX - this.data.photoPosX > offset && this.data.currentIndex + 1 !== this.data.total) {
        this.gotoSlide(this.data.next);
        return;
      }

      if (flagX === 0 && flagY === 0) {
        this.vx = this.photoVX / 5;
        this.vy = this.photoVY / 5;
      } else {
        this._registerElasticForce(flagX,flagY);
      }
    }
  }

  beforeGesture () {
    const pos = this._getGesturePos(this.e);
    const distance = this._getDistance(pos[0],pos[1]);
    this.isBeingZoomed = true;
    this.oldDistance = distance;
    this.data.scale = true;
    this.e.preventDefault();
  }

  onGesture () {
    const pos = this._getGesturePos(this.e);
    const distance = this._getDistance(pos[0],pos[1]);
    const size = (distance - this.oldDistance) / 100;
    const oldScaleSize = this.data.scaleSize;
    const posX = this.data.photoPosX;
    const posY = this.data.photoPosY;
    const item = this._getSelectedItem();
    let translate = 1;
    this.data.scaleSize += this._round(size,6);
    if(this.data.scaleSize < 0.2) {
      this.data.scaleSize = 0.2;
    }
    //todo
    if(this.data.scaleSize < oldScaleSize) {
      this.data.photoPosX = (1 + this.data.scaleSize - oldScaleSize) * posX;
      this.data.photoPosY = (1 + this.data.scaleSize - oldScaleSize) * posY;
    }

    if(this.data.scaleSize < 1 || this.data.scaleSize > this._getScaleBoarder()){
      this.data.hideUi = true;
    }else{
      this.data.hideUi = false;
    }
    this.oldDistance = distance;
    this.e.preventDefault();
    this._photoUpdate();
  }

  afterGesture () {
    this.isBeingZoomed = false;
    if(this.data.scaleSize > this._getScaleBoarder()) {
      return;
    }
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this.data.scale = false;
    this.data.scaleSize = 1;
    this.data.hideUi = false;
    this._photoUpdate();
  }

  _getForceAndTheta (vx,vy) {
    return {
      force: Math.sqrt(vx*vx + vy*vy),
      theta: Math.atan2(vy,vx)
    }
  }

  _getScaleBoarder () {
    const item = this._getSelectedItem();
    if(!util.isSmartPhone()){
      return 1 / item.scale;
    }
    if(item.width > item.height){
      return window.innerHeight / (item.height*item.scale);
    }else{
      return window.innerWidth / (item.width*item.scale);
    }
  }

  _makeBound (item) {
    let width = item.width * item.scale * this.data.scaleSize;
    let height = item.height * item.scale * this.data.scaleSize;
    let minX,minY,maxX,maxY;
    if(window.innerWidth > width){
      maxX = (window.innerWidth - width) / 2;
      minX = -1 * maxX;
    }else{
      maxX = (width - window.innerWidth) / 2;
      minX = -1 * maxX;
    }
    if(window.innerHeight > height){
      maxY = (window.innerHeight - height) / 2;
      minY = -1 * maxY;
    }else{
      maxY = (height - window.innerHeight) / 2;
      minY = -1 * maxY;
    }
    return {
      minX: this._round(minX,6)*this.data.scaleSize,
      minY: this._round(minY,6)*this.data.scaleSize,
      maxX: this._round(maxX,6)*this.data.scaleSize,
      maxY: this._round(maxY,6)*this.data.scaleSize
    }
  }

  _registerElasticForce (x, y) {
    const item = this._getSelectedItem();
    const bound = this._makeBound(item);
    this.data.elastic = true;
    if(x === 1){
      this.data.photoPosX = bound.minX;
    }else if(x === -1){
      this.data.photoPosX = bound.maxX;
    }
    if(y === 1){
      this.data.photoPosY = bound.minY;
    }else if (y === -1){
      this.data.photoPosY = bound.maxY;
    }
    this._photoUpdate();
    setTimeout(() => {
      this.data.elastic = false;
      this._photoUpdate();
    },300);
  }

  _getSelectedItem () {
    const data = this.data;
    const index = data.currentIndex;
    return data.group[data.currentGroup][index];
  }

  _getUniqId () {
    return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
  }

  _getDistance (point1, point2) {
    const x = point1.x - point2.x;
    const y = point1.y - point2.y;
    return Math.sqrt(x*x+y*y);
  }

  _round (val, precision) {
    const digit = Math.pow(10,precision);
    val = val * digit;
    val = Math.round(val);
    val = val / digit;
    return val;
  }

  _isTouched (e) {
    if (e && e.touches) {
      return true;
    } else {
      return false;
    }
  }

  _isGestured (e) {
    if (e && e.touches && e.touches.length > 1) {
      return true;
    } else {
      return false;
    }
  }

  _isSmartPhone () {
    const agent = navigator.userAgent
    if (agent.indexOf('iPhone') > 0 || agent.indexOf('iPad') > 0
        || agent.indexOf('ipod') > 0 || agent.indexOf('Android') > 0) {
      return true
    } else {
      return false
    }
  }

  _calcGravity (gamma,beta) {
    if(gamma > 5 || gamma < -5) {
      this.vx += gamma * 0.05;
    }
    if(this.data.verticalGravity === false){
      return;
    }
    if(beta > 5 || beta < -5){
      this.vy += beta * 0.05;
    }
  }

  _photoUpdate () {
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
      util.addClass(img,classNames.smartPhotoImgOnMove);
    } else {
      util.removeClass(img,classNames.smartPhotoImgOnMove);
    }
    if (this.data.elastic) {
      util.addClass(img,classNames.smartPhotoImgElasticMove);
    } else {
      util.removeClass(img,classNames.smartPhotoImgElasticMove);
    }
    if (this.data.hideUi) {
      util.addClass(nav,'hide');
      util.addClass(arrows,'hide');
      setTimeout(() => {
        util.addClass(nav,'none');
        util.addClass(arrows,'none');
      },100)
    } else {
      util.removeClass(nav,'none');
      util.removeClass(arrows,'none');
      setTimeout(() => {
        util.removeClass(nav,'hide');
        util.removeClass(arrows,'hide');
      },10)
    }
  }

  _listUpdate () {
    const classNames = this.data.classNames;
    const list = this._getElementByQuery(`.${classNames.smartPhotoList}`);
    const transform = `translate(${this.data.translateX}px,${this.data.translateY}px)`;
    list.style.transform = transform;
    // $list
    if(this.data.onMoveClass) {
      util.addClass(list,classNames.smartPhotoListOnMove);
    }else{
      util.removeClass(list,classNames.smartPhotoListOnMove);
    }
  }

  _doAnim () {
    if (this.isBeingZoomed || this.isSwipable || this.photoSwipable || this.data.elastic || !this.data.scale ){
      return;
    }
    this.data.photoPosX += this.vx;
    this.data.photoPosY += this.vy;
    const item = this._getSelectedItem();
    const bound = this._makeBound(item);
    if(this.data.photoPosX < bound.minX){
      this.data.photoPosX = bound.minX;
      this.vx *= -0.2;
    }else if(this.data.photoPosX > bound.maxX){
      this.data.photoPosX = bound.maxX;
      this.vx *= -0.2;
    }
    if(this.data.photoPosY < bound.minY){
      this.data.photoPosY = bound.minY;
      this.vy *= -0.2;
    }else if (this.data.photoPosY > bound.maxY){
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
    this.vx = Math.cos(theta)*force;
    this.vy = Math.sin(theta)*force;
    this._photoUpdate();
  }

}

module.exports = smartPhoto;
