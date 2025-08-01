import SmartPhoto from '../../src/index.js';
import '../../scss/smartphoto.scss';

// LazyLoad is loaded from CDN in the HTML
new LazyLoad({
  elements_selector: '.lazy',
});

new SmartPhoto('.js-img-viewer', {
  lazyAttribute: 'data-src',
});
