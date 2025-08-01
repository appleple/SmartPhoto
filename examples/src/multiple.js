import SmartPhoto from '../../src/index.js';
import '../../scss/smartphoto.scss';

window.addEventListener('load', function () {
  new SmartPhoto('.js-img-viewer');
  new SmartPhoto('.js-img-viewer-fit');
});
