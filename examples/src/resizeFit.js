import SmartPhoto from '../../src/index';
import '../../styles/smartphoto.css';

document.addEventListener('DOMContentLoaded', function () {
  new SmartPhoto('.js-img-viewer', {
    resizeStyle: 'fit',
  });
});
