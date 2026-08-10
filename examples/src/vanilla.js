import SmartPhoto from '../../src/index';
import '../../scss/smartphoto.scss';

document.addEventListener('DOMContentLoaded', function () {
  const sm = new SmartPhoto('.js-img-viewer', {
    // showAnimation: false
  });
  // sm.destroy();
});
