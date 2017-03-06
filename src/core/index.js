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
		coolPhotoArrowLeft: 'cool-photo-arrow-left'
	},
	arrows:true,
	dots:true,
	animationSpeed: 300
}

class coolPhoto {

	constructor (element, settings) {
		settings = extend({},defaults,settings);
		this.element = element;
		this.settings = settings;
		const index = this.addNewAsset();
		element.setAttribute('data-index', index);
		element.addEventListener('click', (event) => {
			this.render();
			this.dispatchEvent();
			event.preventDefault();
		});
	}

	dispatchEvent () {
		const element = this.element.nextElementSibling;
		const settings = this.settings;

		element.addEventListener('click', (event) => {
			const target = event.target;
			if (dom.hasClass(target,settings.classNames.coolPhotoArrowLeft)) {
				const index = target.getAttribute('data-index');
				const event = new Event('click');
				this.removeComponent();
				assets[index].element.dispatchEvent(event);
			} else if (dom.hasClass(target,settings.classNames.coolPhotoArrowRight)) {
				const index = target.getAttribute('data-index');
				const event = new Event('click');
				this.removeComponent();
				assets[index].element.dispatchEvent(event);

			} else {
				this.removeComponent();
			}
		});

		element.addEventListener('mousedown', (event) => {
			if (dom.hasClass(settings.classNames.coolPhotoImg)){

			}
		});
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
}

module.exports = coolPhoto;

