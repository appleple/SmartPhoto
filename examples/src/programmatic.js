import SmartPhoto from '../../src/index';
import '../../scss/smartphoto.scss';

// データソースモード(§3): HTML の <a> を一切読み取らず、配列を直接渡して構築する
const slides = [
  { src: '/large-lion.jpg', thumb: '/lion.jpg', caption: 'Lion', id: 'lion' },
  { src: '/large-camel.jpg', thumb: '/camel.jpg', caption: 'Camel', id: 'camel' },
  { src: '/large-koala.jpg', thumb: '/koala.jpg', caption: 'Koala', id: 'koala', width: 1200, height: 800 },
];

document.addEventListener('DOMContentLoaded', function () {
  const photo = new SmartPhoto(slides);

  photo.on('change', () => {
    console.log('change', photo.currentIndex);
  });

  document.querySelector('.js-open-index').addEventListener('click', () => {
    photo.show(0);
  });

  document.querySelector('.js-open-id').addEventListener('click', () => {
    photo.show('koala');
  });

  document.querySelector('.js-next').addEventListener('click', () => {
    photo.next();
  });

  document.querySelector('.js-prev').addEventListener('click', () => {
    photo.prev();
  });

  document.querySelector('.js-hide').addEventListener('click', () => {
    photo.hide();
  });

  document.querySelectorAll('.js-thumb').forEach((img) => {
    img.addEventListener('click', (e) => {
      const index = Number(e.currentTarget.dataset.index);
      photo.show(index, { trigger: e.currentTarget });
    });
  });
});
