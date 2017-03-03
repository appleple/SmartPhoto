const extend = require('../lib/extend');
const dom = require('../lib/dom');

const defaults = {
	classNames: {
		coolPhoto: 'cool-photo',
		coolPhotoClose: 'cool-photo-close',
		coolPhotoBody: 'cool-photo-body',
		coolPhotoInner: 'cool-photo-inner',
		coolPhotoImg: 'cool-photo-img',
		coolPhotoArrows: 'cool-photo-arrows'
	},
	arrows:true,
	dots:true,
	animationSpeed: 300
}

const dispatchEvent = (element, settings) => {
	element.addEventListener('click', (event) => {
		if (event.target === element) {
			dom.addClass(element,settings.classNames.coolPhotoClose);
			setTimeout(() => {
				dom.remove(element);
			},settings.animationSpeed);
		}
	});
}

const render = (element, settings) => {
	const src = element.getAttribute('data-src');
	const html =  `
		<div class="${settings.classNames.coolPhoto}">
			<div class="${settings.classNames.coolPhotoBody}">
				<div class="${settings.classNames.coolPhotoInner}">
					<img src="${src}" class="${settings.classNames.coolPhotoImg}">
					${settings.arrows ? `
						<ul class="${settings.classNames.coolPhotoArrows}">
							<li></li>
							<li></li>
						</ul>
					` : ''}
				</div>
			</div>
		</div>
	`
	element.insertAdjacentHTML('afterend', html);
}


module.exports = (element, settings) => {
	settings = extend({},defaults,settings);
	element.addEventListener('click', () => {
		render(element, settings);
		const imgViwer = element.nextElementSibling;
		dispatchEvent(imgViwer, settings);
	});
}
