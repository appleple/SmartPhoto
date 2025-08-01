import SmartPhoto from '../../src/index.js';
import '../../scss/smartphoto.scss';

document.addEventListener('DOMContentLoaded', function() {
  var photo = new SmartPhoto(".js-img-viewer");

  photo.on('change', function() {
    console.log('change');
  });

  photo.on('close', function() {
    console.log('close');
  });

  photo.on('swipestart', function() {
    console.log('swipestart');
  });

  photo.on('swipeend', function() {
    console.log('swipeend');
  });

  photo.on('loadall', function() {
    console.log('loadall');
  });

  photo.on('zoomin', function() {
    console.log('zoomin');
  });

  photo.on('zoomout', function() {
    console.log('zoomout');
  });

  photo.on('open', function() {
    console.log('open');
  });
});
