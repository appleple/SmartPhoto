import SmartPhoto from '../../src/index.js';
import '../../scss/smartphoto.scss';

document.addEventListener('DOMContentLoaded', function () {
  new SmartPhoto('.js-img-viewer', {
    resizeStyle: 'fit',
  });
});
