'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _aTemplate2 = require('a-template');

var _aTemplate3 = _interopRequireDefault(_aTemplate2);

var _zeptoBrowserify = require('zepto-browserify');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var util = require('../lib/util');
var template = require('./viwer.html');
var Keyboard = require('keyboard-js').Keyboard;

var defaults = {
  classNames: {
    smartPhoto: 'smart-photo',
    smartPhotoClose: 'smart-photo-close',
    smartPhotoBody: 'smart-photo-body',
    smartPhotoInner: 'smart-photo-inner',
    smartPhotoContent: 'smart-photo-content',
    smartPhotoImg: 'smart-photo-img',
    smartPhotoImgOnMove: 'smart-photo-img-onmove',
    smartPhotoImgElasticMove: 'smart-photo-img-elasticmove',
    smartPhotoImgWrap: 'smart-photo-img-wrap',
    smartPhotoArrows: 'smart-photo-arrows',
    smartPhotoNav: 'smart-photo-nav',
    smartPhotoArrowRight: 'smart-photo-arrow-right',
    smartPhotoArrowLeft: 'smart-photo-arrow-left',
    smartPhotoImgLeft: 'smart-photo-img-left',
    smartPhotoImgRight: 'smart-photo-img-right',
    smartPhotoList: 'smart-photo-list',
    smartPhotoListOnMove: 'smart-photo-list-onmove',
    smartPhotoHeader: 'smart-photo-header',
    smartPhotoCount: 'smart-photo-count',
    smartPhotoCaption: 'smart-photo-caption',
    smartPhotoDismiss: 'smart-photo-dismiss',
    smartPhotoLoader: 'smart-photo-loader',
    smartPhotoLoaderWrap: 'smart-photo-loader-wrap'
  },
  arrows: true,
  nav: true,
  animationSpeed: 300,
  swipeOffset: 100,
  maxWidth: 940,
  headerHeight: 60,
  footerHeight: 60,
  forceInterval: 10,
  registance: 0.5,
  scaleOnClick: true,
  allowVerticalGravity: false,
  useOrientationApi: true
};

var smartPhoto = function (_aTemplate) {
  (0, _inherits3.default)(smartPhoto, _aTemplate);

  function smartPhoto(selector, settings) {
    (0, _classCallCheck3.default)(this, smartPhoto);

    var _this = (0, _possibleConstructorReturn3.default)(this, (smartPhoto.__proto__ || (0, _getPrototypeOf2.default)(smartPhoto)).call(this));

    _this.data = util.extend({}, defaults, settings);
    _this.data.currentIndex = 0;
    _this.data.hide = true;
    _this.data.group = {};
    _this.data.scaleSize = 1;
    _this.data.scale = false;
    _this.pos = { x: 0, y: 0 };
    _this.data.photoPosX = 0;
    _this.data.photoPosY = 0;
    _this.convert = {
      increment: _this.increment,
      virtualPos: _this.virtualPos
    };
    _this.data.groupItems = _this.groupItems;
    _this.elements = document.querySelectorAll(selector);
    var date = new Date();
    _this.tapSecond = date.getTime();
    _this.onListMove = false;
    _this.id = _this._getUniqId();
    _this.vx = 0;
    _this.vy = 0;
    _this.addTemplate(_this.id, template);
    _this.data.isSmartPhone = _this._isSmartPhone();

    (0, _zeptoBrowserify.$)('body').append('<div data-id=\'' + _this.id + '\'></div>');
    [].forEach.call(_this.elements, function (element, index) {
      _this.addNewItem(element);
    });

    _this._getEachImageSize().then(function () {
      _this._resetTranslate();
      _this.setPosByCurrentIndex();
      _this.setSizeByScreen();
      _this.update();
    });

    var currentItem = _this._getCurrentItemByHash();

    if (currentItem) {
      _this.data.currentIndex = currentItem.index;
      _this.data.currentGroup = currentItem.groupId;
      _this._resetTranslate();
      _this.setPosByCurrentIndex();
      _this.update();
    }

    if (!_this.data.isSmartPhone) {
      _this._setKeyboard();
    }

    (0, _zeptoBrowserify.$)(window).resize(function () {
      _this._resetTranslate();
      _this.setPosByCurrentIndex();
      _this.setSizeByScreen();
      _this.update();
    });

    setInterval(function () {
      _this._doAnim();
    }, _this.data.forceInterval);

    if (!_this.data.isSmartPhone || !_this.data.useOrientationApi) {
      return (0, _possibleConstructorReturn3.default)(_this);
    }

    (0, _zeptoBrowserify.$)(window).on("orientationchange", function (e) {
      _this._resetTranslate();
      _this.setPosByCurrentIndex();
      _this.setHashByCurrentIndex();
      _this.setSizeByScreen();
      _this.update();
    });

    (0, _zeptoBrowserify.$)(window).on("deviceorientation", function (e) {
      if (!_this.isBeingZoomed && !_this.isSwipable && !_this.photoSwipable && !_this.data.elastic && _this.data.scale) {
        if (window.innerHeight > window.innerWidth) {
          _this._calcGravity(e.originalEvent.gamma, e.originalEvent.beta);
        } else {
          _this._calcGravity(e.originalEvent.beta, e.originalEvent.gamma);
        }
      }
    });
    return _this;
  }

  (0, _createClass3.default)(smartPhoto, [{
    key: 'increment',
    value: function increment(item) {
      return item + 1;
    }
  }, {
    key: 'virtualPos',
    value: function virtualPos(pos) {
      pos = parseInt(pos);
      var item = this._getSelectedItem();
      return pos / item.scale / this.data.scaleSize;
    }
  }, {
    key: 'groupItems',
    value: function groupItems() {
      return this.data.group[this.data.currentGroup];
    }
  }, {
    key: '_setKeyboard',
    value: function _setKeyboard() {
      var _this2 = this;

      var keyboard = new Keyboard();
      keyboard.register('slideRight', function () {
        if (_this2.data.hide === true) {
          return;
        }
        _this2.gotoSlide(_this2.data.next);
      }, ['ArrowRight']);
      keyboard.register('slideLeft', function () {
        if (_this2.data.hide === true) {
          return;
        }
        _this2.gotoSlide(_this2.data.prev);
      }, ['ArrowLeft']);
      keyboard.register('hidePhoto', function () {
        if (_this2.data.hide === true) {
          return;
        }
        _this2.hidePhoto();
      }, ['Escape']);
      keyboard.start();
    }
  }, {
    key: '_getEachImageSize',
    value: function _getEachImageSize() {
      var arr = [];
      var group = this.data.group;
      for (var i in group) {
        if (!group.hasOwnProperty(i)) {
          continue;
        }
        group[i].forEach(function (item) {
          var promise = new _promise2.default(function (resolve, reject) {
            var img = new Image();
            img.onload = function () {
              item.width = img.width;
              item.height = img.height;
              item.loaded = true;
              if (item.reserved === true) {
                util.triggerEvent(item.element, 'click');
              }
              resolve();
            };
            img.onerror = function () {
              if (item.reserved === true) {
                util.triggerEvent(item.element, 'click');
              }
              resolve();
            };
            img.src = item.src;
          });
          arr.push(promise);
        });
      }
      return _promise2.default.all(arr);
    }
  }, {
    key: '_resetTranslate',
    value: function _resetTranslate() {
      var items = this.groupItems();
      items.forEach(function (item, index) {
        item.translateX = window.innerWidth * index;
      });
    }
  }, {
    key: 'addNewItem',
    value: function addNewItem(element) {
      var _this3 = this;

      var groupId = element.getAttribute('data-group') || "nogroup";
      var group = this.data.group;
      if (groupId === "nogroup") {
        element.setAttribute("data-group", "nogroup");
      }
      if (!group[groupId]) {
        group[groupId] = [];
      }
      var index = group[groupId].length;
      var item = {
        src: element.getAttribute('href'),
        caption: element.getAttribute('data-caption'),
        groupId: groupId,
        translateX: window.innerWidth * index,
        index: index,
        translateY: 0,
        width: 50,
        height: 50,
        id: element.getAttribute('data-id') || index,
        loaded: false,
        reserved: false, //click予約
        element: element
      };
      group[groupId].push(item);
      this.data.currentGroup = groupId;
      var id = element.getAttribute('data-id');
      if (!id) {
        element.setAttribute('data-id', index);
      }
      element.setAttribute('data-index', index);
      element.addEventListener('click', function (event) {
        event.preventDefault();
        _this3.data.currentGroup = element.getAttribute('data-group');
        _this3.data.currentIndex = parseInt(element.getAttribute('data-index'));
        _this3.data.total = _this3.groupItems().length;
        _this3.setPosByCurrentIndex();
        _this3.setHashByCurrentIndex();
        _this3.setSizeByScreen();
        _this3.setArrow();
        _this3.data.hide = false;
        _this3.data.photoPosX = 0;
        _this3.data.photoPosY = 0;
        if (_this3.data.scaleOnClick === true && _this3.data.isSmartPhone) {
          _this3.data.scale = true;
          _this3.data.hideUi = true;
          _this3.data.scaleSize = _this3._getScaleBoarder();
        }
        _this3.addAppearEffect(element);
        _this3.update();
      });

      if (!location.hash) {
        return;
      }
    }
  }, {
    key: 'addAppearEffect',
    value: function addAppearEffect(element) {
      var _this4 = this;

      var img = element.querySelector('img');
      var clone = img.cloneNode(true);
      document.querySelector('body').appendChild(clone);
      var pos = util.getViewPos(img);
      clone.style.top = '0px';
      clone.style.left = '0px';
      clone.style.position = 'fixed';
      clone.style.width = img.offsetWidth + 'px';
      clone.style.height = img.offsetHeight + 'px';
      clone.style.transform = 'translate(' + pos.left + 'px,' + pos.top + 'px) scale(1)';
      clone.style.zIndex = '102';
      clone.style.opacity = '0.5';

      setTimeout(function () {
        clone.style.transition = 'all .3s ease-out';
        var scale = 1;
        var windowX = window.innerWidth;
        var windowY = window.innerHeight;
        var screenY = windowY - _this4.data.headerHeight - _this4.data.footerHeight;
        if (_this4.data.scaleOnClick === true && _this4.data.isSmartPhone) {
          if (img.offsetWidth > img.offsetHeight) {
            scale = windowY / img.offsetHeight;
          } else {
            scale = windowX / img.offsetWidth;
          }
        } else {
          scale = screenY / img.offsetHeight;
          if (scale * img.offsetWidth > windowX) {
            scale = windowX / img.offsetWidth;
          }
        }
        var x = (scale - 1) / 2 * img.offsetWidth + (windowX - img.offsetWidth * scale) / 2;
        var y = (scale - 1) / 2 * img.offsetHeight + (windowY - img.offsetHeight * scale) / 2;
        clone.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scale + ')';
        clone.style.opacity = '1';
      }, 1);

      setTimeout(function () {
        util.removeElement(clone);
        _this4.data.appear = true;
        var $img = (0, _zeptoBrowserify.$)('.' + _this4.data.classNames.smartPhotoImg, '[data-id="' + _this4.id + '"]');
        $img.addClass('active');
      }, 300);
    }
  }, {
    key: 'addLeaveEffect',
    value: function addLeaveEffect() {}
  }, {
    key: 'hidePhoto',
    value: function hidePhoto() {
      this.data.hide = true;
      this.data.appear = false;
      var scrollLocation = (0, _zeptoBrowserify.$)(window).scrollTop();
      if (location.hash) {
        location.hash = "";
      }
      (0, _zeptoBrowserify.$)(window).scrollTop(scrollLocation);
      this.update();
    }
  }, {
    key: '_getTouchPos',
    value: function _getTouchPos(e) {
      var x = 0;
      var y = 0;
      if (typeof event === 'undefined') {
        var event = this.e;
      }
      if (this._isTouched(event)) {
        x = event.originalEvent.touches[0].pageX;
        y = event.originalEvent.touches[0].pageY;
      } else if (this._isTouched(this.e)) {
        x = this.e.originalEvent.touches[0].pageX;
        y = this.e.originalEvent.touches[0].pageY;
      } else if (event.pageX) {
        x = event.pageX;
        y = event.pageY;
      }
      return { x: x, y: y };
    }
  }, {
    key: '_getGesturePos',
    value: function _getGesturePos(e) {
      var touches = e.originalEvent.touches;
      return [{ x: touches[0].pageX, y: touches[0].pageY }, { x: touches[1].pageX, y: touches[1].pageY }];
    }
  }, {
    key: 'setPosByCurrentIndex',
    value: function setPosByCurrentIndex() {
      var _this5 = this;

      var items = this.groupItems();
      var moveX = -1 * items[this.data.currentIndex].translateX;
      this.pos.x = moveX;
      setTimeout(function () {
        _this5.data.translateX = moveX;
        _this5._listUpdate();
      }, 1);
    }
  }, {
    key: 'setHashByCurrentIndex',
    value: function setHashByCurrentIndex() {
      var scrollLocation = (0, _zeptoBrowserify.$)(window).scrollTop();
      var items = this.groupItems();
      var id = items[this.data.currentIndex].id;
      var group = this.data.currentGroup;
      var hash = 'gid=' + group + '&pid=' + id;
      location.hash = hash;
      (0, _zeptoBrowserify.$)(window).scrollTop(scrollLocation);
    }
  }, {
    key: '_getCurrentItemByHash',
    value: function _getCurrentItemByHash() {
      var group = this.data.group;
      var hash = location.hash.substr(1);
      var hashObj = util.parseQuery(hash);
      var currentItem = null;
      for (var i in group) {
        if (!group.hasOwnProperty(i)) {
          continue;
        }
        group[i].forEach(function (item) {
          if (hashObj.gid === item.groupId && hashObj.pid === item.id) {
            item.reserved = true;
            currentItem = item;
          }
        });
      }
      return currentItem;
    }
  }, {
    key: 'setSizeByScreen',
    value: function setSizeByScreen() {
      var windowX = window.innerWidth;
      var windowY = window.innerHeight;
      var headerHeight = this.data.headerHeight;
      var footerHeight = this.data.footerHeight;
      var screenY = windowY - (headerHeight + footerHeight);
      var items = this.groupItems();
      items.forEach(function (item) {
        item.scale = screenY / item.height;
        item.x = (item.scale - 1) / 2 * item.width + (windowX - item.width * item.scale) / 2;
        item.y = (item.scale - 1) / 2 * item.height + (windowY - item.height * item.scale) / 2;
        if (item.width * item.scale > windowX) {
          item.scale = windowX / item.width;
          item.x = (item.scale - 1) / 2 * item.width;
        }
      });
    }
  }, {
    key: 'slideList',
    value: function slideList() {
      var _this6 = this;

      this.data.onMoveClass = true;
      this.setPosByCurrentIndex();
      this.setHashByCurrentIndex();
      this.setSizeByScreen();
      setTimeout(function () {
        _this6.data.onMoveClass = false;
        _this6.setArrow();
        _this6.update();
      }, 200);
    }
  }, {
    key: 'gotoSlide',
    value: function gotoSlide(index) {
      this.data.currentIndex = parseInt(index);
      if (!this.data.currentIndex) {
        this.data.currentIndex = 0;
      }
      this.slideList();
    }
  }, {
    key: 'setArrow',
    value: function setArrow() {
      var items = this.groupItems();
      var length = items.length;
      var next = this.data.currentIndex + 1;
      var prev = this.data.currentIndex - 1;
      this.data.showNextArrow = false;
      this.data.showPrevArrow = false;
      if (next !== length) {
        this.data.next = next;
        this.data.showNextArrow = true;
      }
      if (prev !== -1) {
        this.data.prev = prev;
        this.data.showPrevArrow = true;
      }
    }
  }, {
    key: 'beforeDrag',
    value: function beforeDrag() {
      if (this._isGestured(this.e)) {
        this.beforeGesture();
        return;
      }
      if (this.data.scale) {
        this.beforePhotoDrag();
        return;
      }
      var pos = this._getTouchPos(this.e);
      this.isSwipable = true;
      this.firstPos = pos;
      this.oldPos = pos;
    }
  }, {
    key: 'afterDrag',
    value: function afterDrag() {
      this.isSwipable = false;
      this.onListMove = false;
      var items = this.groupItems();
      if (this.isBeingZoomed) {
        this.afterGesture();
        return;
      }
      this.isBeingZoomed = false;
      if (this.data.scale) {
        this.afterPhotoDrag();
        return;
      } else if (!util.isSmartPhone() && this.oldPos.x === this.firstPos.x) {
        this.zoomPhoto();
        return;
      }
      var date = new Date();
      var tapSecond = date.getTime();
      if (Math.abs(this.tapSecond - tapSecond) < 200) {
        this.e.preventDefault();
        this.zoomPhoto();
        return;
      }
      this.tapSecond = tapSecond;
      var swipeWidth = this.oldPos.x - this.firstPos.x;
      if (swipeWidth >= this.data.swipeOffset && this.data.currentIndex !== 0) {
        this.data.currentIndex--;
      } else if (swipeWidth <= -this.data.swipeOffset && this.data.currentIndex != items.length - 1) {
        this.data.currentIndex++;
      }
      this.slideList();
    }
  }, {
    key: 'onDrag',
    value: function onDrag() {
      this.e.preventDefault();
      if (this._isGestured(this.e) && this.onListMove === false) {
        this.onGesture();
        return;
      }
      if (this.isBeingZoomed) {
        return;
      }
      if (this.data.scale) {
        this.onPhotoDrag();
        return;
      }
      if (!this.isSwipable) {
        return;
      }
      var pos = this._getTouchPos(this.e);
      var x = pos.x - this.oldPos.x;
      this.pos.x += x;
      this.onListMove = true;
      this.data.translateX = this.pos.x;
      this.oldPos = pos;
      this._listUpdate();
    }
  }, {
    key: 'zoomPhoto',
    value: function zoomPhoto() {
      var _this7 = this;

      this.data.hideUi = true;
      this.data.scaleSize = this._getScaleBoarder();
      this.data.photoPosX = 0;
      this.data.photoPosY = 0;
      this._photoUpdate();
      setTimeout(function () {
        _this7.data.scale = true;
        _this7._photoUpdate();
      }, 300);
    }
  }, {
    key: 'zoomOutPhoto',
    value: function zoomOutPhoto() {
      this.data.scaleSize = 1;
      this.isBeingZoomed = false;
      this.data.hideUi = false;
      this.data.scale = false;
      this.data.photoPosX = 0;
      this.data.photoPosY = 0;
      this._photoUpdate();
    }
  }, {
    key: 'beforePhotoDrag',
    value: function beforePhotoDrag() {
      var pos = this._getTouchPos(this.e);
      this.photoSwipable = true;
      if (!this.data.photoPosX) {
        this.data.photoPosX = 0;
      }
      if (!this.data.photoPosY) {
        this.data.photoPosY = 0;
      }
      this.oldPhotoPos = pos;
      this.firstPhotoPos = pos;
    }
  }, {
    key: 'onPhotoDrag',
    value: function onPhotoDrag() {
      if (!this.photoSwipable) {
        return;
      }
      this.e.preventDefault();
      var pos = this._getTouchPos(this.e);
      var x = pos.x - this.oldPhotoPos.x;
      var y = pos.y - this.oldPhotoPos.y;
      var moveX = this._round(this.data.scaleSize * x, 6);
      var moveY = this._round(this.data.scaleSize * y, 6);
      if (typeof moveX === "number") {
        this.data.photoPosX += moveX;
        this.photoVX = moveX;
      }
      if (typeof moveY === "number") {
        this.data.photoPosY += moveY;
        this.photoVY = moveY;
      }
      this.oldPhotoPos = pos;
      this._photoUpdate();
    }
  }, {
    key: 'afterPhotoDrag',
    value: function afterPhotoDrag() {
      if (this.oldPhotoPos.x === this.firstPhotoPos.x && this.photoSwipable) {
        this.zoomOutPhoto();
      } else {
        var item = this._getSelectedItem();
        var bound = this._makeBound(item);
        var flagX = 0;
        var flagY = 0;
        if (this.data.photoPosX > bound.maxX) {
          flagX = -1;
        } else if (this.data.photoPosX < bound.minX) {
          flagX = 1;
        }
        if (this.data.photoPosY > bound.maxY) {
          flagY = -1;
        } else if (this.data.photoPosY < bound.minY) {
          flagY = 1;
        }
        if (flagX === 0 && flagY === 0) {
          this.vx = this.photoVX / 5;
          this.vy = this.photoVY / 5;
        } else {
          this._registerElasticForce(flagX, flagY);
        }
      }
      this.photoSwipable = false;
    }
  }, {
    key: 'beforeGesture',
    value: function beforeGesture() {
      var pos = this._getGesturePos(this.e);
      var distance = this._getDistance(pos[0], pos[1]);
      this.isBeingZoomed = true;
      this.oldDistance = distance;
      this.data.scale = true;
      this.e.preventDefault();
    }
  }, {
    key: 'onGesture',
    value: function onGesture() {
      var pos = this._getGesturePos(this.e);
      var distance = this._getDistance(pos[0], pos[1]);
      var size = (distance - this.oldDistance) / 100;
      var oldScaleSize = this.data.scaleSize;
      var posX = this.data.photoPosX;
      var posY = this.data.photoPosY;
      var item = this._getSelectedItem();
      var translate = 1;
      this.data.scaleSize += this._round(size, 6);
      //todo
      if (this.data.scaleSize < oldScaleSize) {
        this.data.photoPosX = (1 + this.data.scaleSize - oldScaleSize) * posX;
        this.data.photoPosY = (1 + this.data.scaleSize - oldScaleSize) * posY;
      }

      if (this.data.scaleSize < 1 || this.data.scaleSize > this._getScaleBoarder()) {
        this.data.hideUi = true;
      } else {
        this.data.hideUi = false;
      }
      this.oldDistance = distance;
      this.e.preventDefault();
      this._photoUpdate();
    }
  }, {
    key: 'afterGesture',
    value: function afterGesture() {
      this.isBeingZoomed = false;
      if (this.data.scaleSize > this._getScaleBoarder()) {
        return;
      }
      this.data.photoPosX = 0;
      this.data.photoPosY = 0;
      this.data.scale = false;
      this.data.scaleSize = 1;
      this.data.hideUi = false;
      this._photoUpdate();
    }
  }, {
    key: '_getForceAndTheta',
    value: function _getForceAndTheta(vx, vy) {
      return {
        force: Math.sqrt(vx * vx + vy * vy),
        theta: Math.atan2(vy, vx)
      };
    }
  }, {
    key: '_getScaleBoarder',
    value: function _getScaleBoarder() {
      var item = this._getSelectedItem();
      if (!util.isSmartPhone()) {
        return 1 / item.scale;
      }
      if (item.width > item.height) {
        return window.innerHeight / (item.height * item.scale);
      } else {
        return window.innerWidth / (item.width * item.scale);
      }
    }
  }, {
    key: '_makeBound',
    value: function _makeBound(item) {
      var width = item.width * item.scale * this.data.scaleSize;
      var height = item.height * item.scale * this.data.scaleSize;
      var minX = void 0,
          minY = void 0,
          maxX = void 0,
          maxY = void 0;
      if (window.innerWidth > width) {
        maxX = (window.innerWidth - width) / 2;
        minX = -1 * maxX;
      } else {
        maxX = (width - window.innerWidth) / 2;
        minX = -1 * maxX;
      }
      if (window.innerHeight > height) {
        maxY = (window.innerHeight - height) / 2;
        minY = -1 * maxY;
      } else {
        maxY = (height - window.innerHeight) / 2;
        minY = -1 * maxY;
      }
      return {
        minX: this._round(minX, 6) * this.data.scaleSize,
        minY: this._round(minY, 6) * this.data.scaleSize,
        maxX: this._round(maxX, 6) * this.data.scaleSize,
        maxY: this._round(maxY, 6) * this.data.scaleSize
      };
    }
  }, {
    key: '_registerElasticForce',
    value: function _registerElasticForce(x, y) {
      var _this8 = this;

      var item = this._getSelectedItem();
      var bound = this._makeBound(item);
      this.data.elastic = true;
      if (x === 1) {
        this.data.photoPosX = bound.minX;
      } else if (x === -1) {
        this.data.photoPosX = bound.maxX;
      }
      if (y === 1) {
        this.data.photoPosY = bound.minY;
      } else if (y === -1) {
        this.data.photoPosY = bound.maxY;
      }
      this._photoUpdate();
      setTimeout(function () {
        _this8.data.elastic = false;
        _this8._photoUpdate();
      }, 300);
    }
  }, {
    key: '_getSelectedItem',
    value: function _getSelectedItem() {
      var data = this.data;
      var index = data.currentIndex;
      return data.group[data.currentGroup][index];
    }
  }, {
    key: '_getUniqId',
    value: function _getUniqId() {
      return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
    }
  }, {
    key: '_getDistance',
    value: function _getDistance(point1, point2) {
      var x = point1.x - point2.x;
      var y = point1.y - point2.y;
      return Math.sqrt(x * x + y * y);
    }
  }, {
    key: '_round',
    value: function _round(val, precision) {
      var digit = Math.pow(10, precision);
      val = val * digit;
      val = Math.round(val);
      val = val / digit;
      return val;
    }
  }, {
    key: '_isTouched',
    value: function _isTouched(e) {
      if (e && e.originalEvent && e.originalEvent.touches) {
        return true;
      } else {
        return false;
      }
    }
  }, {
    key: '_isGestured',
    value: function _isGestured(e) {
      if (e && e.originalEvent && e.originalEvent.touches && e.originalEvent.touches.length > 1) {
        return true;
      } else {
        return false;
      }
    }
  }, {
    key: '_isSmartPhone',
    value: function _isSmartPhone() {
      var agent = navigator.userAgent;
      if (agent.indexOf('iPhone') > 0 || agent.indexOf('iPad') > 0 || agent.indexOf('ipod') > 0 || agent.indexOf('Android') > 0) {
        return true;
      } else {
        return false;
      }
    }
  }, {
    key: '_calcGravity',
    value: function _calcGravity(gamma, beta) {
      if (gamma > 5 || gamma < -5) {
        this.vx += gamma * 0.05;
      }
      if (this.data.allowVerticalGravity === false) {
        return;
      }
      if (beta > 5 || beta < -5) {
        this.vy += beta * 0.05;
      }
    }
  }, {
    key: '_photoUpdate',
    value: function _photoUpdate() {
      var classNames = this.data.classNames;
      var $current = (0, _zeptoBrowserify.$)('.current', '[data-id="' + this.id + '"]');
      var $this = (0, _zeptoBrowserify.$)('.' + classNames.smartPhotoImg, $current);
      var photoPosX = this.virtualPos(this.data.photoPosX);
      var photoPosY = this.virtualPos(this.data.photoPosY);
      var scaleSize = this.data.scaleSize;
      var transform = 'translate(' + photoPosX + 'px,' + photoPosY + 'px) scale(' + scaleSize + ')';
      var $nav = (0, _zeptoBrowserify.$)('.' + classNames.smartPhotoNav, '[data-id="' + this.id + '"]');
      var $arrows = (0, _zeptoBrowserify.$)('.' + classNames.smartPhotoArrows, '[data-id="' + this.id + '"]');
      $this.css('transform', transform);
      if (this.data.scale) {
        $this.addClass(classNames.smartPhotoImgOnMove);
      } else {
        $this.removeClass(classNames.smartPhotoImgOnMove);
      }
      if (this.data.elastic) {
        $this.addClass(classNames.smartPhotoImgElasticMove);
      } else {
        $this.removeClass(classNames.smartPhotoImgElasticMove);
      }
      if (this.data.hideUi) {
        $nav.addClass('hide');
        $arrows.addClass('hide');
        setTimeout(function () {
          $nav.addClass('none');
          $arrows.addClass('none');
        }, 100);
      } else {
        $nav.removeClass('none');
        $arrows.removeClass('none');
        setTimeout(function () {
          $nav.removeClass('hide');
          $arrows.removeClass('hide');
        }, 10);
      }
    }
  }, {
    key: '_listUpdate',
    value: function _listUpdate() {
      var classNames = this.data.classNames;
      var $list = (0, _zeptoBrowserify.$)('.' + classNames.smartPhotoList, '[data-id="' + this.id + '"]');
      var transform = 'translateX(' + this.data.translateX + 'px)';
      $list.css('transform', transform);
      // $list
      if (this.data.onMoveClass) {
        $list.addClass(classNames.smartPhotoListOnMove);
      } else {
        $list.removeClass(classNames.smartPhotoListOnMove);
      }
    }
  }, {
    key: '_doAnim',
    value: function _doAnim() {
      if (this.isBeingZoomed || this.isSwipable || this.photoSwipable || this.data.elastic || !this.data.scale) {
        return;
      }
      this.data.photoPosX += this.vx;
      this.data.photoPosY += this.vy;
      var item = this._getSelectedItem();
      var bound = this._makeBound(item);
      if (this.data.photoPosX < bound.minX) {
        this.data.photoPosX = bound.minX;
        this.vx *= -0.2;
      } else if (this.data.photoPosX > bound.maxX) {
        this.data.photoPosX = bound.maxX;
        this.vx *= -0.2;
      }
      if (this.data.photoPosY < bound.minY) {
        this.data.photoPosY = bound.minY;
        this.vy *= -0.2;
      } else if (this.data.photoPosY > bound.maxY) {
        this.data.photoPosY = bound.maxY;
        this.vy *= -0.2;
      }
      var power = this._getForceAndTheta(this.vx, this.vy);
      var force = power.force;
      var theta = power.theta;
      force -= this.data.registance;
      if (Math.abs(force) < 0.5) {
        return;
      }
      this.vx = Math.cos(theta) * force;
      this.vy = Math.sin(theta) * force;
      this._photoUpdate();
    }
  }]);
  return smartPhoto;
}(_aTemplate3.default);

module.exports = smartPhoto;
