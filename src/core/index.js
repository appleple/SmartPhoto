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

function getRand (a, b) {
  return ~~(Math.random() * (b - a + 1)) + a;
}

function getRandText (limit) {
  let ret = "";
  let strings = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let length = strings.length;
  for (let i = 0; i < limit; i++) {
    ret += strings.charAt(Math.floor(getRand(0, length)));
  }
  return ret;
}

function * getUniqId (limit) {
  const ids = []
  while(true) {
    let id = getRandText(limit)
    while(true) {
      let flag = true
      ids.forEach((item) => {
        if(item === id){
          flag = false
          id = getRandText(limit)
        }
      })
      if(flag === true) {
        break
      }
    }
    ids.push(id)
    yield id
  }
}

const idGen = getUniqId(10)

class coolPhoto extends aTemplate {

  constructor (selector, settings) {
    super();
    this.data = util.extend({},defaults,settings);
    this.data.currentIndex = 0;
    this.data.hide = true;
    this.data.items = [];
    this.pos = { x: 0, y: 0};
    this.elements = document.querySelectorAll(selector);
    this.id = idGen.next().value;
    this.addTemplate(this.id,template);
    $('body').append(`<div data-id='${this.id}'></div>`);
    this.update();
    [].forEach.call(this.elements, (element,index) => {
      this.addNewItem(element,index);
    });
  }

  addNewItem (element, index) {
    console.log(window.innerWidth*index);
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

	getTouchPos (e) {
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
      return;
    }
    const pos = this.getTouchPos(this.e);
    this.isSwipable = true;
    this.firstPos = pos;
    this.oldPos = pos;
  }

  afterDrag () {
    this.isSwipable = false;
    if(this.oldPos.x === this.firstPos.x) {
      this.zoomPhoto();
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
    if(!this.isSwipable){
      return;
    }
    this.e.preventDefault();
    const pos = this.getTouchPos(this.e);
    const x = pos.x - this.oldPos.x;
    this.pos.x += x;
    this.data.translateX = this.pos.x;
    this.oldPos = pos;
    this.update();
  }

  zoomPhoto(){
    if(!this.data.scale){
      this.data.scale = true;
    }else{
      this.data.scale = false;
    }
    this.update();
  }

}

module.exports = coolPhoto;
