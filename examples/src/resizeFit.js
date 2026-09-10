import SmartPhoto from '../../src/index';
import '../../styles/smartphoto.css';

document.addEventListener('DOMContentLoaded', function () {
  // 診断用: ?speed=3000 のようにアニメーション速度を落として挙動をコマ送りで確認できる
  const speed = new URLSearchParams(location.search).get('speed');
  new SmartPhoto('.js-img-viewer', {
    resizeStyle: 'fill',
    ...(speed ? { animationSpeed: Number(speed) } : {}),
  });
});
