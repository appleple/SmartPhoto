import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/dom';
import SmartPhoto from '../src/index.js';

describe('SmartPhoto', () => {
  let container;
  let smartPhoto;

  beforeEach(() => {
    // テスト用のHTMLをセットアップ
    container = document.createElement('div');
    container.innerHTML = `
      <div class="gallery">
        <a href="./assets/large-lion.jpg" class="js-smartphoto" data-caption="Lion" data-id="lion" data-group="test">
          <img src="./assets/lion.jpg" width="360" alt="Lion" />
        </a>
        <a href="./assets/large-camel.jpg" class="js-smartphoto" data-caption="Camel" data-id="camel" data-group="test">
          <img src="./assets/camel.jpg" width="360" alt="Camel" />
        </a>
        <a href="./assets/large-hippo.jpg" class="js-smartphoto" data-caption="Hippo" data-id="hippo" data-group="test">
          <img src="./assets/hippo.jpg" width="360" alt="Hippo" />
        </a>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    // クリーンアップ
    if (smartPhoto) {
      smartPhoto.destroy();
    }
    document.body.removeChild(container);
    // ダイアログを削除
    const dialogs = document.querySelectorAll('.smartphoto');
    dialogs.forEach((dialog) => dialog.remove());
  });

  describe('初期化', () => {
    it('should initialize SmartPhoto with default settings', () => {
      smartPhoto = new SmartPhoto('.js-smartphoto');
      expect(smartPhoto).toBeDefined();
      expect(smartPhoto.data.arrows).toBe(true);
      expect(smartPhoto.data.nav).toBe(true);
    });

    it('should initialize SmartPhoto with custom settings', () => {
      smartPhoto = new SmartPhoto('.js-smartphoto', {
        arrows: false,
        nav: false,
        message: {
          gotoNextImage: 'Next',
          gotoPrevImage: 'Previous',
          closeDialog: 'Close',
        },
      });
      expect(smartPhoto.data.arrows).toBe(false);
      expect(smartPhoto.data.nav).toBe(false);
      expect(smartPhoto.data.message.gotoNextImage).toBe('Next');
    });

    it('should add items to the group', () => {
      smartPhoto = new SmartPhoto('.js-smartphoto');
      const items = smartPhoto.groupItems();
      expect(items).toHaveLength(3);
      expect(items[0].caption).toBe('Lion');
      expect(items[1].caption).toBe('Camel');
      expect(items[2].caption).toBe('Hippo');
    });
  });

  describe('ダイアログの表示/非表示', () => {
    beforeEach(() => {
      smartPhoto = new SmartPhoto('.js-smartphoto');
    });

    it('should open dialog when clicking on an image', async () => {
      const firstImage = container.querySelector('.js-smartphoto');
      fireEvent.click(firstImage);

      // ダイアログが表示されるまで待機
      await waitFor(() => {
        const dialog = document.querySelector('.smartphoto');
        expect(dialog).toBeInTheDocument();
      });
    });

    it('should close dialog when clicking close button', async () => {
      const firstImage = container.querySelector('.js-smartphoto');
      fireEvent.click(firstImage);

      await waitFor(() => {
        const dialog = document.querySelector('.smartphoto');
        expect(dialog).toBeInTheDocument();
      });

      const closeButton = document.querySelector('.smartphoto-dismiss');
      fireEvent.click(closeButton);

      await waitFor(() => {
        const dialog = document.querySelector('.smartphoto');
        expect(dialog).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('should close dialog with ESC key', async () => {
      const firstImage = container.querySelector('.js-smartphoto');
      fireEvent.click(firstImage);

      await waitFor(() => {
        const dialog = document.querySelector('.smartphoto');
        expect(dialog).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape', keyCode: 27 });

      await waitFor(() => {
        const dialog = document.querySelector('.smartphoto');
        expect(dialog).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('ナビゲーション', () => {
    beforeEach(async () => {
      smartPhoto = new SmartPhoto('.js-smartphoto');
      const firstImage = container.querySelector('.js-smartphoto');
      fireEvent.click(firstImage);
      await waitFor(() => {
        expect(document.querySelector('.smartphoto')).toBeInTheDocument();
      });
    });

    it('should navigate with thumbnail navigation', async () => {
      const thumbnails = document.querySelectorAll('.smartphoto-nav a');
      expect(thumbnails).toHaveLength(3);

      // 3番目のサムネイルをクリック
      fireEvent.click(thumbnails[2]);

      await waitFor(() => {
        const caption = document.querySelector('.smartphoto-caption').textContent;
        expect(caption).toBe('Hippo');
      });
    });
  });

  describe('アクセシビリティ', () => {
    beforeEach(async () => {
      smartPhoto = new SmartPhoto('.js-smartphoto');
      const firstImage = container.querySelector('.js-smartphoto');
      fireEvent.click(firstImage);
      await waitFor(() => {
        expect(document.querySelector('.smartphoto')).toBeInTheDocument();
      });
    });

    it('should have proper ARIA attributes on dialog', () => {
      const dialog = document.querySelector('.smartphoto');
      expect(dialog).toHaveAttribute('role', 'dialog');
    });

    it('should have screen reader text for buttons', () => {
      const closeButton = document.querySelector('.smartphoto-dismiss');
      const srText = closeButton.querySelector('.smartphoto-sr-only');
      expect(srText).toBeInTheDocument();
      expect(srText.textContent).toBe('close the image dialog');
    });

    it('should have proper ARIA labels for navigation', () => {
      const prevButton = document.querySelector('.smartphoto-arrow-left a');
      const nextButton = document.querySelector('.smartphoto-arrow-right a');

      expect(prevButton).toHaveAttribute('role', 'button');
      expect(nextButton).toHaveAttribute('role', 'button');

      const prevSrText = prevButton.querySelector('.smartphoto-sr-only');
      const nextSrText = nextButton.querySelector('.smartphoto-sr-only');

      expect(prevSrText.textContent).toBe('go to the previous image');
      expect(nextSrText.textContent).toBe('go to the next image');
    });

    it('should have live region for caption updates', () => {
      const caption = document.querySelector('.smartphoto-caption');
      expect(caption).toHaveAttribute('aria-live', 'polite');
    });

    it('should have proper tabindex for focusable elements', () => {
      const caption = document.querySelector('.smartphoto-caption');
      expect(caption).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('設定オプション', () => {
    it('should use custom messages', async () => {
      smartPhoto = new SmartPhoto('.js-smartphoto', {
        message: {
          gotoNextImage: 'Next Image',
          gotoPrevImage: 'Previous Image',
          closeDialog: 'Close Dialog',
        },
      });

      const firstImage = container.querySelector('.js-smartphoto');
      fireEvent.click(firstImage);

      await waitFor(() => {
        const nextButton = document.querySelector('.smartphoto-arrow-right a');
        const srText = nextButton.querySelector('.smartphoto-sr-only');
        expect(srText.textContent).toBe('Next Image');
      });
    });
  });
});
