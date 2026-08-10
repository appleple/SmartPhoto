import SmartPhoto from '../../src/index';
import '../../styles/smartphoto.css';

window.addEventListener('load', function () {
  new SmartPhoto('.js-img-viewer');
  new SmartPhoto('.js-img-viewer-fit');
});
