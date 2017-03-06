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

const addNewAsset = (element) => {
	const src = element.getAttribute('href');
	assets.push({
		src:src,
		element:element
	});
	return assets.length - 1;
}

const getAsset = (index) => {
	return assets[index];
}

const removeComponent = (element, settings) => {
	dom.addClass(element,settings.classNames.coolPhotoClose);
	// element.removeEventListener('click');
	setTimeout(() => {
		dom.remove(element);
	},settings.animationSpeed);
}

const dispatchEvent = (element, settings) => {
	element.addEventListener('click', (event) => {
		const target = event.target;
		if (dom.hasClass(target,settings.classNames.coolPhotoArrowLeft)) {
			const index = target.getAttribute('data-index');
			const event = new Event('click');
			removeComponent(element, settings);
			assets[index].element.dispatchEvent(event);
		} else if (dom.hasClass(target,settings.classNames.coolPhotoArrowRight)) {
			const index = target.getAttribute('data-index');
			const event = new Event('click');
			removeComponent(element, settings);
			assets[index].element.dispatchEvent(event);

		} else {
			removeComponent(element, settings);
		}
	});

	element.addEventListener('mousedown', (event) => {
		if (dom.hasClass(settings.classNames.coolPhotoImg)){

		}
	});

}

const render = (element, settings) => {
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


module.exports = (element, settings) => {
	const index = addNewAsset(element);
	element.setAttribute('data-index', index);
	settings = extend({},defaults,settings);
	element.addEventListener('click', () => {
		render(element, settings);
		const imgViwer = element.nextElementSibling;
		dispatchEvent(imgViwer, settings);
	});
}
