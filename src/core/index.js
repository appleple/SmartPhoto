import aTemplate from 'a-template';
import { $ } from 'zepto-browserify';

const util = require('../lib/util');
const template = require('./viwer.html');

const defaults = {
  classNames: {
    coolPhoto: 'cool-photo',
    coolPhotoClose: 'cool-photo-close',
    coolPhotoBody: 'cool-photo-body',
    coolPhotoInner: 'cool-photo-inner',
    coolPhotoImg: 'cool-photo-img',
    coolPhotoImgOnMove: 'cool-photo-img-onmove',
    coolPhotoImgElasticMove: 'cool-photo-img-elasticmove',
    coolPhotoImgWrap: 'cool-photo-img-wrap',
    coolPhotoArrows: 'cool-photo-arrows',
    coolPhotoNav: 'cool-photo-nav',
    coolPhotoArrowRight: 'cool-photo-arrow-right',
    coolPhotoArrowLeft: 'cool-photo-arrow-left',
    coolPhotoImgLeft: 'cool-photo-img-left',
    coolPhotoImgRight: 'cool-photo-img-right',
    coolPhotoList: 'cool-photo-list',
    coolPhotoListOnMove: 'cool-photo-list-onmove',
    coolPhotoHeader: 'cool-photo-header',
    coolPhotoCount: 'cool-photo-count',
    coolPhotoCaption: 'cool-photo-caption',
    coolPhotoDismiss: 'cool-photo-dismiss'
  },
  arrows:true,
  nav:true,
  animationSpeed: 300,
  swipeOffset: 100,
  maxWidth: 940,
  headerHeight:60,
  footerHeight:60,
  forceInterval:10,
  registance:0.01,
  scaleOnClick:true,
  useOrientationApi:true
}

class coolPhoto extends aTemplate {

  constructor (selector, settings) {
    super();
    this.data = util.extend({},defaults,settings);
    this.data.currentIndex = 0;
    this.data.hide = true;
    this.data.items = [];
    this.data.scaleSize = 1;
    this.data.scale = false;
    this.pos = { x: 0, y: 0};
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this.convert = {
      increment:this.increment,
      virtualPos:this.virtualPos
    };
    this.elements = document.querySelectorAll(selector);
    this.data.total = this.elements.length;
    this.id = this._getUniqId();
    this.vx = 0;
    this.vy = 0;
    this.addTemplate(this.id,template);
    $('body').append(`<div data-id='${this.id}'></div>`);
    this._getEachImageSize().then(() => {
      [].forEach.call(this.elements, (element,index) => {
        this.addNewItem(element,index);
      });
      this._setup();
    });
  }

  _setup () {
    this.update();
    $(window).resize(() => {
      this._resetTranslate();
      this.setPosByCurrentIndex();
      this.setSizeByScreen();
      this.update();
    }).resize();

    setInterval(()=>{
      this._doAnim();
    },this.data.forceInterval);

    if(!this.data.useOrientationApi){
      return;
    }

    if(!this._isSmartPhone()){
      return;
    }

    $(window).on("orientationchange", (e) => {
      this._resetTranslate();
      this.setPosByCurrentIndex();
      this.setSizeByScreen();
      this.update();
    });

    $(window).on("deviceorientation", (e) => {
      if(!this.isBeingZoomed && !this.isSwipable && !this.photoSwipable && !this.data.elastic && this.data.scale){
        if(!this.gamma){
          this.gamma = e.originalEvent.gamma;
          this.beta = e.originalEvent.beta;
        }
        this._calcGravity(e.originalEvent.gamma - this.gamma,e.originalEvent.beta - this.beta);
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

  _getEachImageSize () {
    const arr = [];
    [].forEach.call(this.elements, (element,index) => {
      this.data.items.push({src: element.getAttribute('href'),caption: element.getAttribute('data-caption'), translateX: window.innerWidth*index, index: index, translateY:0});
    });
    this.data.items.forEach((item) => {
      const promise = new Promise((resolve,reject) => {
        const img = new Image();
        img.onload = () => {
          item.width = img.width;
          item.height = img.height;
          resolve();
        }
        img.src = item.src;
      });
      arr.push(promise);
    });
    return Promise.all(arr);
  }

  _resetTranslate () {
    this.data.items.forEach((item,index) => {
      item.translateX = window.innerWidth * index;
    });
  }

  addNewItem (element, index) {
    element.setAttribute('data-index',index);
    element.addEventListener('click', (event) => {
      let lockOrientation = screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation;
      if (lockOrientation) {
        lockOrientation("portrait");
      }
      event.preventDefault();
      this.data.currentIndex = parseInt(element.getAttribute('data-index'));
      this.setPosByCurrentIndex();
      this.setSizeByScreen();
      this.setArrow();
      this.data.hide = false;
      this.data.photoPosX = 0;
      this.data.photoPosY = 0;
      if(this.data.scaleOnClick === true){
        this.data.scale = true;
        this.data.hideUi = true;
        this.data.scaleSize = this._getScaleBoarder();
      }
      this.update();
    });
  }

  hidePhoto () {
    this.data.hide = true;
    let unlockOrientation = screen.unlockOrientation || screen.mozUnlockOrientation || screen.msUnlockOrientation;
    if(unlockOrientation){
      unlockOrientation();
    }
    this.update();
  }

  _getTouchPos () {
    let x = 0;
    let y = 0;
    if (this._isTouched(event)) {
      x = event.originalEvent.touches[0].pageX;
      y = event.originalEvent.touches[0].pageY;
    } else if(event.pageX){
      x = event.pageX;
      y = event.pageY;
    }
    return { x: x, y: y };
  }

  _getGesturePos (e) {
    const touches = e.originalEvent.touches;
     return [
      { x: touches[0].pageX, y: touches[0].pageY},
      { x: touches[1].pageX, y: touches[1].pageY}
    ]
  }

  setPosByCurrentIndex () {
    const moveX = -1 * this.data.items[this.data.currentIndex].translateX;
    this.pos.x = moveX;
    setTimeout(() => {
      this.data.translateX = moveX;
      this.update();
    },1);
  }

  setSizeByScreen () {
    const windowX = window.innerWidth;
    const windowY = window.innerHeight;
    const headerHeight = this.data.headerHeight;
    const footerHeight = this.data.footerHeight;
    const screenY = windowY - (headerHeight + footerHeight);
    this.data.items.forEach((item) => {
      item.scale = screenY / item.height;
      item.x = (item.scale - 1) / 2 * item.width + (windowX - (item.width *item.scale)) / 2;
      item.y = (item.scale - 1) / 2 * item.height+ (windowY - (item.height *item.scale)) / 2;
      if(item.width * item.scale > windowX){
        item.scale = windowX / item.width;
        item.x = (item.scale - 1) / 2 * item.width;
      }
    });
  }

  slideList () {
    this.data.onMoveClass = true;
    this.setPosByCurrentIndex();
    this.setSizeByScreen();
    setTimeout(() => {
      this.data.onMoveClass = false;
      this.setArrow();
      this.update();
    },300);
  }

  gotoSlide(index) {
    this.data.currentIndex = parseInt(index);
    if(!this.data.currentIndex) {
      this.data.currentIndex = 0;
    }
    this.slideList();
  }

  setArrow(){
    const length = this.data.items.length;
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
    if (this._isTouched(this.e)) {
      this.beforeGesture();
      return;
    }
    if(this.data.scale){
      this.beforePhotoDrag();
      return;
    }
    const pos = this._getTouchPos(this.e);
    this.isSwipable = true;
    this.firstPos = pos;
    this.oldPos = pos;
  }

  afterDrag () {
    this.isSwipable = false;
    if (this.isBeingZoomed) {
      this.afterGesture();
      return;
    }
    this.isBeingZoomed = false;
    if(this.data.scale){
      this.afterPhotoDrag();
      return;
    } else if (this.oldPos.x === this.firstPos.x) {
      if(!util.isSmartPhone()) {
        this.zoomPhoto();
      }
      return;
    }
    const swipeWidth = this.oldPos.x - this.firstPos.x
    if (swipeWidth >= this.data.swipeOffset && this.data.currentIndex !== 0 ) {
      this.data.currentIndex--;
    } else if (swipeWidth <= - this.data.swipeOffset && this.data.currentIndex != this.data.items.length -1 ) {
      this.data.currentIndex++;
    }
    this.slideList();
  }

  onDrag () {
    this.e.preventDefault();
    if (this._isTouched(this.e)) {
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
    this.pos.x += x;
    this.data.translateX = this.pos.x;
    this.oldPos = pos;
    this.update();
  }

  zoomPhoto(){
    this.data.scale = true;
    this.data.scaleSize =  this._getScaleBoarder();
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this.update();
  }

  zoomOutPhoto(){
    this.data.scaleSize = 1;
    this.isBeingZoomed = false;
    this.data.hideUi = false;
    this.data.scale = false;
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this.update();
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
    this.update();
  }

  afterPhotoDrag () {
    if(this.oldPhotoPos.x === this.firstPhotoPos.x && this.photoSwipable) {
      this.zoomOutPhoto();
    }else{
      const item = this._getSelectedItem();
      const bound = this._makeBound(item);
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
      if (flagX === 0 && flagY === 0) {
        this.vx = this.photoVX / 5;
        this.vy = this.photoVY / 5;
      } else {
        this._registerElasticForce(flagX,flagY);
      }
    }
    this.photoSwipable = false;
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
    this.update();
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
    this.update();
  }

  preventBrowserAction () {
    this.e.preventDefault();
  }

  _getForceAndTheta (vx,vy) {
    return {
      force: Math.sqrt(vx*vx + vy*vy),
      theta: Math.atan2(vy,vx)
    }
  }

  _getScaleBoarder () {
    const item = this._getSelectedItem();
    return window.innerHeight / (item.height*item.scale)
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
    this.update();
    setTimeout(()=>{
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
      this.update();
    },1);
    setTimeout(() => {
      this.data.elastic = false;
      this.update();
    },300);
  }

  _getSelectedItem () {
    const index = this.data.currentIndex;
    return this.data.items[index];
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

  _isTouched (event) {
    if (event && event.originalEvent && event.originalEvent.touches && event.originalEvent.touches.length > 1) {
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
      this.vx += gamma * 0.02;
    }
    if(beta > 5 || beta < -5){
      this.vy += beta * 0.02;
    }
  }

  _photoUpdate () {
    const $current = $('.current',`[data-id="${this.id}"]`);
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
    force -= 0.1;
    this.vx = Math.cos(theta)*force;
    this.vy = Math.sin(theta)*force;
    this.update();
  }

}

module.exports = coolPhoto;
