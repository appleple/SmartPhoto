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
		coolPhotoArrows: 'cool-photo-arrows',
    coolPhotoNav: 'cool-photo-nav',
		coolPhotoArrowRight: 'cool-photo-arrow-right',
		coolPhotoArrowLeft: 'cool-photo-arrow-left',
    coolPhotoImgLeft: 'cool-photo-img-left',
    coolPhotoImgRight: 'cool-photo-img-right',
    coolPhotoList: 'cool-photo-list',
    coolPhotoListOnMove: 'cool-photo-list-onmove'
	},
	arrows:true,
	nav:true,
	animationSpeed: 300,
  swipeOffset: 100
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
    this.elements = document.querySelectorAll(selector);
    this.id = this._getUniqId();
    this.addTemplate(this.id,template);
    $('body').append(`<div data-id='${this.id}'></div>`);
    this.update();
    [].forEach.call(this.elements, (element,index) => {
      this.addNewItem(element,index);
    });
    $(window).resize(() => {
      this.data.items.forEach((item)=>{
        let index = item.index;
        item.translateX = window.innerWidth*index;
        this.setPosByCurrentIndex();
        this.update();
      });
    });
  }

  addNewItem (element, index) {
    this.data.items.push({src: element.getAttribute('href'), translateX: window.innerWidth*index, index: index});
    element.setAttribute('data-index',index);
    element.addEventListener('click', (event) => {
      event.preventDefault();
      this.data.currentIndex = parseInt(element.getAttribute('data-index'));
      this.setPosByCurrentIndex();
      this.setArrow();
      this.data.hide = false;
      this.update();
    });
  }

  hidePhoto () {
    if($(this.e.target).hasClass(this.data.classNames.coolPhotoInner) || $(this.e.target).hasClass(this.data.classNames.coolPhotoBody)){
      this.data.hide = true;
      this.update();
    }
  }

	_getTouchPos (e) {
		let x = 0;
		let y = 0;
		if (event && event.originalEvent && event.originalEvent.touches && event.originalEvent.touches[0].pageX) {
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
    this.pos.x = -1 * this.data.currentIndex * window.innerWidth;
    setTimeout(()=> {
      this.data.translateX = this.pos.x;
      this.update();
    },1);
  }

  slideList () {
    this.data.onMoveClass = true;
    this.setPosByCurrentIndex();
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
    if(this.data.scale){
      this.beforePhotoDrag();
      return;
    }
    const event = this.e;
    if (event && event.originalEvent && event.originalEvent.touches && event.originalEvent.touches.length > 1){
      this.beforeGesture();
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
    const event = this.e;
    if (event && event.originalEvent && event.originalEvent.touches && event.originalEvent.touches.length > 1) {
      this.onGesture();
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
    this.data.scaleSize = 2;
    this.data.photoPosX = 0;
    this.data.photoPosY = 0;
    this.update();
  }

  zoomOutPhoto(){
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
    this.data.photoPosX += x;
    this.data.photoPosY += y;
    this.oldPhotoPos = pos;
    this.update();
  }

  afterPhotoDrag () {
    if(this.oldPhotoPos.x === this.firstPhotoPos.x && this.photoSwipable) {
      this.zoomOutPhoto();
    }
    this.photoSwipable = false;
  }

  beforeGesture () {
    const pos = this._getGesturePos(this.e);
    const distance = this._getDistance(pos[0],pos[1]);
    this.isBeingZoomed = true;
    this.firstDistance = distance;
    this.data.scale = true;
    this.e.preventDefault();
  }

  onGesture () {
    const pos = this._getGesturePos(this.e);
    this.distance = this._getDistance(pos[0],pos[1]);
    const size = 1 + (this.distance - this.firstDistance) / this.firstDistance;
    this.data.scaleSize = size;
    if(this.data.scaleSize < 1 || this.data.scaleSize > 1.8){
      this.data.hideUi = true;
    }else{
      this.data.hideUi = false;
    }
    this.e.preventDefault();
    this.update();
  }

  afterGesture () {
    this.isBeingZoomed = false;
    if(this.data.scaleSize > 1.8) {
      return;
    }
    this.data.scale = false;
    this.data.scaleSize = 1;
    this.data.hideUi = false;
    this.update();
  }

  preventBrowserAction () {
    this.e.preventDefault();
  }

  _getUniqId () {
    return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
  }

  _getDistance (point1, point2) {
    const x = point1.x - point2.x;
    const y = point1.y - point2.y;
    return Math.sqrt(x*x+y*y);
  }

}

module.exports = coolPhoto;
