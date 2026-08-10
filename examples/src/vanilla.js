import SmartPhoto from '../../src/index';
import '../../styles/smartphoto.css';

document.addEventListener('DOMContentLoaded', function () {
  const sm = new SmartPhoto('.js-img-viewer', {
    // showAnimation: false
  });
  // sm.destroy();
});
