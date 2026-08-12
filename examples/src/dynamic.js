import SmartPhoto from '../../src/index';
import '../../styles/smartphoto.css';

// Ajaxで後から読み込まれるであろうサムネイル群を模したデータ。
// 実際のAjax呼び出しの代わりに setTimeout で遅延を再現している
const lazyThumbnails = [
  { href: '/large-koala.jpg', thumb: '/koala.jpg', caption: 'Koala', id: 'koala' },
  { href: '/large-hippo.jpg', thumb: '/hippo.jpg', caption: 'Hippo', id: 'hippo' },
  { href: '/large-lion.jpg', thumb: '/lion.jpg', caption: 'Lion', id: 'lion' },
];
let loadedCount = 0;

function appendThumbnail(gallery, { href, thumb, caption, id }) {
  const brick = document.createElement('div');
  brick.className = 'brick';

  const a = document.createElement('a');
  a.href = href;
  a.className = 'js-smartphoto';
  a.dataset.caption = caption;
  a.dataset.id = id;
  a.dataset.group = 'gallery';

  const img = document.createElement('img');
  img.src = thumb;
  img.width = 360;
  img.alt = caption;

  a.appendChild(img);
  brick.appendChild(a);
  gallery.appendChild(brick);
}

document.addEventListener('DOMContentLoaded', function () {
  // 文字列セレクタで構築する(HTMLスキャンモード)。これにより、以降
  // Ajax等でDOMに追加されたマッチ要素もクリック時に自動検出される
  new SmartPhoto('.js-smartphoto');

  const gallery = document.querySelector('.js-gallery');
  document.querySelector('.js-load-more').addEventListener('click', () => {
    // Ajaxのレスポンス待ちを模した遅延。addItem()/addNewItem() は一度も呼ばない
    setTimeout(() => {
      const next = lazyThumbnails[loadedCount];
      if (next) {
        appendThumbnail(gallery, next);
        loadedCount += 1;
      }
    }, 300);
  });

  document.querySelector('.js-remove-first').addEventListener('click', () => {
    // 削除もAjax相当の遅延を模して行う。destroy()/reload()の類は一切呼ばない
    setTimeout(() => {
      const first = gallery.querySelector('.js-smartphoto');
      first?.closest('.brick')?.remove();
    }, 300);
  });
});
