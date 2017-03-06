const extend = require('../lib/extend');
const dom = require('../lib/dom');
const assets = [];

const defaults = {
	classNames: {
		coolPhoto: 'cool-photo',
		coolPhotoClose: 'cool-photo-close',
		coolPhotoBody: 'cool-photo-body',
		coolPhotoInner: 'cool-photo-inner',
		coolPhotoImg: 'cool-photo-img',
		coolPhotoArrows: 'cool-photo-arrows',
		coolPhotoArrowRight: 'cool-photo-arrow-right',
		coolPhotoArrowLeft: 'cool-photo-arrow-left',
    coolPhotoImgLeft: 'cool-photo-img-left',
    coolPhotoImgRight: 'cool-photo-img-right'
	},
	arrows:true,
	dots:true,
	animationSpeed: 300,
  swipeOffset: 100
}

class coolPhoto {

	constructor (element, settings) {
		settings = extend({},defaults,settings);
		this.element = element;
		this.settings = settings;
		this.index = this.addNewAsset();
    this.isSmartPhone = coolPhoto.isSmartPhone();
		element.setAttribute('data-index', this.index);
		element.addEventListener('click', (event) => {
      event.preventDefault();
			this.render();
			this.dispatchEvent();
		});
	}

	dispatchEvent () {
    const element = this.element.nextElementSibling;
		element.addEventListener('click',this.onClick.bind(this));
    if(this.isSmartPhone){
      element.addEventListener('touchstart', this.onTouchStart.bind(this));
      element.addEventListener('touchmove', this.onTouchMove.bind(this));
      element.addEventListener('touchend', this.onTouchEnd.bind(this));
    }else{
      element.addEventListener('mousedown', this.onTouchStart.bind(this));
      element.addEventListener('mousemove', this.onTouchMove.bind(this));
      element.addEventListener('mouseup', this.onTouchEnd.bind(this));
    }
	}
  
  onClick (event) {
 		const element = this.element.nextElementSibling;
		const settings = this.settings;
    const index = this.index;
		const target = event.target;
    if (dom.hasClass(target,settings.classNames.coolPhotoArrowLeft)) {
      const event = new Event('click');
      this.removeComponent();
      assets[index - 1].element.dispatchEvent(event);
    } else if (dom.hasClass(target,settings.classNames.coolPhotoArrowRight)) {
      const event = new Event('click');
      this.removeComponent();
      assets[index + 1].element.dispatchEvent(event);
    } else if (!dom.hasClass(target,settings.classNames.coolPhotoImg)) {
      this.removeComponent();
    }
  }

  onTouchStart (event) {
    const target = event.target;
    const settings = this.settings;
    if (dom.hasClass(target,settings.classNames.coolPhotoImg)){
      const pos = this.getTouchPos(event);
      this.isSwipable = true;
      this.pos = { x: 0, y: 0 };
      this.oldPos = pos;
    }
    event.preventDefault();
  }

  onTouchMove (event) {
    const target = event.target;
    const settings = this.settings;
    if (dom.hasClass(target,settings.classNames.coolPhotoImg) && this.isSwipable){
      const pos = this.getTouchPos(event);
      const x = pos.x - this.oldPos.x;
      this.pos.x += x;
      target.style.transform = `translateX(${this.pos.x}px)`;
      this.oldPos = pos;
    }
    event.preventDefault();
  }

  onTouchEnd (event) {
    const element = this.element.nextElementSibling;
		const settings = this.settings;
		const target = event.target;
    const photoImg = element.querySelector(`.${settings.classNames.coolPhotoImg}`);
    let nextIndex = this.index;
    let move = false;
    if(!this.isSwipable) {
      return;
    }
    this.isSwipable = false;
    if (this.pos.x < - this.settings.swipeOffset) {
      photoImg.style.transition = 'all .3s';
      setTimeout(()=>{
        dom.addClass(photoImg,this.settings.classNames.coolPhotoImgRight);
      },1);
      move = true;
      nextIndex++;
    } else if (this.pos.x > this.settings.swipeOffset){
      photoImg.style.transition = 'all .3s';
      setTimeout(()=>{
        dom.addClass(photoImg,this.settings.classNames.coolPhotoImgLeft);
      },1);
      move = true;
      nextIndex--;
    } else if (this.pos.x === 0) {
      console.log(photoImg.width);
    } else {
      photoImg.style.transition = 'all .3s';
      setTimeout(()=>{
        photoImg.style.transform = 'translateX(0px)';
      },1);
      setTimeout(()=>{
        photoImg.style.transition = 'none';
      })
    }
    if (!move) {
      return;
    }
    setTimeout(()=>{
      this.removeComponent();
      const event = new Event('click');
      assets[nextIndex].element.dispatchEvent(event);
    },settings.animationSpeed);
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


	addNewAsset () {
		const element = this.element;
		const src = element.getAttribute('href');
		assets.push({
			src:src,
			element:element
		});
		return assets.length - 1;
	}

	getAsset (index) {
		return assets[index];
	}

	removeComponent () {
		const element = this.element.nextElementSibling;
		const settings = this.settings;
		dom.addClass(element,settings.classNames.coolPhotoClose);
		// element.removeEventListener('click');
		setTimeout(() => {
			dom.remove(element);
		},settings.animationSpeed);
	}

	render () {
		const element = this.element;
		const settings = this.settings;
		const index = parseInt(element.getAttribute('data-index'));
		const src = assets[index].src;
		const html =  `
			<div class="${settings.classNames.coolPhoto}">
				<div class="${settings.classNames.coolPhotoBody}">
					<div class="${settings.classNames.coolPhotoInner}">
						<img src="${src}" class="${settings.classNames.coolPhotoImg}">
						${settings.arrows ? `
							<ul class="${settings.classNames.coolPhotoArrows}">
								${index > 0 ? `
									<li class="${settings.classNames.coolPhotoArrowLeft}" data-index="${index - 1}"></li>
								` : ''}
								${index !== assets.length - 1 ? `
									<li class="${settings.classNames.coolPhotoArrowRight}" data-index="${index + 1}"></li>
								` : ''}
							</ul>
						` : ''}
					</div>
				</div>
			</div>
		`;
		element.insertAdjacentHTML('afterend', html);
	}

  static isSmartPhone () {
    const agent = navigator.userAgent
    if (agent.indexOf('iPhone') > 0 || agent.indexOf('iPad') > 0
        || agent.indexOf('ipod') > 0 || agent.indexOf('Android') > 0) {
      return true
    } else {
      return false
    }
  }

}

module.exports = coolPhoto;

