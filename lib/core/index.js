'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports['default'] = void 0;

var _aTemplate = _interopRequireDefault(require('a-template'));

require('custom-event-polyfill');

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

function _typeof(obj) {
  if (typeof Symbol === 'function' && typeof Symbol.iterator === 'symbol') {
    _typeof = function _typeof(obj) {
      return typeof obj;
    };
  } else {
    _typeof = function _typeof(obj) {
      return obj &&
        typeof Symbol === 'function' &&
        obj.constructor === Symbol &&
        obj !== Symbol.prototype
        ? 'symbol'
        : typeof obj;
    };
  }
  return _typeof(obj);
}

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError('Cannot call a class as a function');
  }
}

function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ('value' in descriptor) descriptor.writable = true;
    Object.defineProperty(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

function _possibleConstructorReturn(self, call) {
  if (call && (_typeof(call) === 'object' || typeof call === 'function')) {
    return call;
  }
  return _assertThisInitialized(self);
}

function _assertThisInitialized(self) {
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  return self;
}

function _getPrototypeOf(o) {
  _getPrototypeOf = Object.setPrototypeOf
    ? Object.getPrototypeOf
    : function _getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
      };
  return _getPrototypeOf(o);
}

function _inherits(subClass, superClass) {
  if (typeof superClass !== 'function' && superClass !== null) {
    throw new TypeError('Super expression must either be null or a function');
  }
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: { value: subClass, writable: true, configurable: true },
  });
  if (superClass) _setPrototypeOf(subClass, superClass);
}

function _setPrototypeOf(o, p) {
  _setPrototypeOf =
    Object.setPrototypeOf ||
    function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };
  return _setPrototypeOf(o, p);
}

var template =
  '<div class="\\{classNames.smartPhoto\\}"<!-- BEGIN hide:exist --> aria-hidden="true"<!-- END hide:exist --><!-- BEGIN hide:empty --> aria-hidden="false"<!-- END hide:empty --> role="dialog" tabindex="-1">\n\t<div class="\\{classNames.smartPhotoBody\\}">\n\t\t<div class="\\{classNames.smartPhotoInner\\}">\n\t\t\t<div class="\\{classNames.smartPhotoHeader\\}">\n\t\t\t\t<span class="\\{classNames.smartPhotoCount\\}">{currentIndex}[increment]/{total}</span>\n\t\t\t\t<span class="\\{classNames.smartPhotoCaption\\}" aria-live="polite"><!-- BEGIN groupItems:loop --><!-- \\BEGIN currentIndex:touch#{index} -->{caption}<!-- \\END currentIndex:touch#{index} --><!-- END groupItems:loop --></span>\n\t\t\t</div>\n\n\t\t\t<div class="\\{classNames.smartPhotoContent\\}"<!-- BEGIN isSmartPhone:exist --> data-action-touchstart="beforeDrag" data-action-touchmove="onDrag" data-action-touchend="afterDrag(false)"<!-- END isSmartPhone:exist --><!-- BEGIN isSmartPhone:empty --> data-action-click="hidePhoto()"<!-- END isSmartPhone:empty -->>\n\t\t\t</div>\n\n\t\t\t<ul style="transform:translate({translateX}[round]px,{translateY}[round]px);" class="\\{classNames.smartPhotoList\\}<!-- BEGIN onMoveClass:exist --> \\{classNames.smartPhotoListOnMove\\}<!-- END onMoveClass:exist -->">\n\t\t\t\t<!-- BEGIN groupItems:loop -->\n\t\t\t\t<li style="transform:translate({translateX}[round]px,{translateY}[round]px);" class="<!-- \\BEGIN currentIndex:touch#{index} -->current<!-- \\END currentIndex:touch#{index} -->">\n\t\t\t\t\t<!-- BEGIN processed:exist -->\n\t\t\t\t\t<div style="transform:translate({x}[round]px,{y}[round]px) scale({scale});" class="\\\\{classNames.smartPhotoImgWrap\\\\}"<!-- \\BEGIN isSmartPhone:empty --> data-action-mousemove="onDrag" data-action-mousedown="beforeDrag" data-action-mouseup="afterDrag"<!-- \\END isSmartPhone:empty --><!-- \\BEGIN isSmartPhone:exist --> data-action-touchstart="beforeDrag" data-action-touchmove="onDrag" data-action-touchend="afterDrag"<!-- \\END isSmartPhone:exist -->>\n\t\t\t\t\t\t<img style="<!-- \\BEGIN currentIndex:touch#{index} -->transform:translate(\\{photoPosX\\}[virtualPos]px,\\{photoPosY\\}[virtualPos]px) scale(\\{scaleSize\\});<!-- \\END currentIndex:touch#{index} -->width:{width}px;" src="{src}" class="\\\\{classNames.smartPhotoImg\\\\}<!-- \\BEGIN scale:exist -->  \\\\{classNames.smartPhotoImgOnMove\\\\}<!-- \\END scale:exist --><!-- \\BEGIN elastic:exist --> \\\\{classNames.smartPhotoImgElasticMove\\\\}<!-- \\END elastic:exist --><!-- \\BEGIN appear:exist --> active<!-- \\END appear:exist -->" ondragstart="return false;">\n\t\t\t\t\t</div>\n\t\t\t\t\t<!-- END processed:exist -->\n\t\t\t\t\t<!-- BEGIN processed:empty -->\n\t\t\t\t\t<div class="\\\\{classNames.smartPhotoLoaderWrap\\\\}">\n\t\t\t\t\t\t<span class="\\\\{classNames.smartPhotoLoader\\\\}"></span>\n\t\t\t\t\t</div>\n\t\t\t\t\t<!-- END processed:empty -->\n\t\t\t\t</li>\n\t\t\t\t<!-- END groupItems:loop -->\n\t\t\t</ul>\n\n\t\t\t<!-- BEGIN arrows:exist -->\n\t\t\t<ul\n\t\t\t\tclass="\\{classNames.smartPhotoArrows\\}"\n\t\t\t\t<!-- BEGIN hideUi:exist --> aria-hidden="true"<!-- END hideUi:exist -->\n\t\t\t\t<!-- BEGIN hideUi:exist --> aria-hidden="false"<!-- END hideUi:exist -->\n\t\t\t\ttabindex="-1">\n\t\t\t\t<li class="\\{classNames.smartPhotoArrowLeft\\}<!-- BEGIN isSmartPhone:exist --> \\{classNames.smartPhotoArrowHideIcon\\}<!-- END isSmartPhone:exist -->"<!-- BEGIN showPrevArrow:empty --> aria-hidden="true"<!-- END showPrevArrow:empty -->><a href="#" data-action-click="gotoSlide({prev})" role="button"><span class="smartphoto-sr-only">\\{message.gotoPrevImage\\}</span></a></li>\n\t\t\t\t<li class="\\{classNames.smartPhotoArrowRight\\}<!-- BEGIN isSmartPhone:exist --> \\{classNames.smartPhotoArrowHideIcon\\}<!-- END isSmartPhone:exist -->"<!-- BEGIN showNextArrow:empty --> aria-hidden="true"<!-- END showNextArrow:empty -->><a href="#" data-action-click="gotoSlide({next})" role="button"><span class="smartphoto-sr-only">\\{message.gotoNextImage\\}</span></a></li>\n\t\t\t</ul>\n\t\t\t<!-- END arrows:exist -->\n\n\t\t\t<!-- BEGIN nav:exist -->\n\t\t\t<nav\n\t\t\t\tclass="\\{classNames.smartPhotoNav\\}"\n\t\t\t\t<!-- BEGIN hideUi:exist -->aria-hidden="true"<!-- END hideUi:exist -->\n\t\t\t\t<!-- BEGIN hideUi:exist --> aria-hidden="false"<!-- END hideUi:exist -->>\n\t\t\t\t<ul>\n\t\t\t\t\t<!-- BEGIN groupItems:loop -->\n\t\t\t\t\t<li><a href="#" data-action-click="gotoSlide({index})" class="<!-- \\BEGIN currentIndex:touch#{index} -->current<!-- \\END currentIndex:touch#{index} -->" style="background-image:url(\'{thumb}\');" role="button"><span class="smartphoto-sr-only">go to {caption}</span></a></li>\n\t\t\t\t\t<!-- END groupItems:loop -->\n\t\t\t\t</ul>\n\t\t\t</nav>\n\t\t\t<!-- END nav:exist -->\n\n\t\t\t<button\n\t\t\t\tclass="\\{classNames.smartPhotoDismiss\\}"\n\t\t\t\tdata-action-click="hidePhoto()">\n\t\t\t\t<span class="smartphoto-sr-only">\\{message.closeDialog\\}</span>\n\t\t\t</button>\n\t\t</div>\n\t\t<!-- BEGIN appearEffect:exist -->\n\t\t<img src=\\{appearEffect.img\\}\n\t\tclass="\\{classNames.smartPhotoImgClone\\}"\n\t\tstyle="width:\\{appearEffect.width\\}px;height:\\{appearEffect.height\\}px;transform:translate(\\{appearEffect.left\\}px,\\{appearEffect.top\\}px) scale(1)" />\n\t\t<!-- END appearEffect:exist -->\n\t</div>\n</div>\n';

var util = require('../lib/util');

var _require = require('es6-promise-polyfill'),
  Promise = _require.Promise;

var defaults = {
  classNames: {
    smartPhoto: 'smartphoto',
    smartPhotoClose: 'smartphoto-close',
    smartPhotoBody: 'smartphoto-body',
    smartPhotoInner: 'smartphoto-inner',
    smartPhotoContent: 'smartphoto-content',
    smartPhotoImg: 'smartphoto-img',
    smartPhotoImgOnMove: 'smartphoto-img-onmove',
    smartPhotoImgElasticMove: 'smartphoto-img-elasticmove',
    smartPhotoImgWrap: 'smartphoto-img-wrap',
    smartPhotoArrows: 'smartphoto-arrows',
    smartPhotoNav: 'smartphoto-nav',
    smartPhotoArrowRight: 'smartphoto-arrow-right',
    smartPhotoArrowLeft: 'smartphoto-arrow-left',
    smartPhotoArrowHideIcon: 'smartphoto-arrow-hide',
    smartPhotoImgLeft: 'smartphoto-img-left',
    smartPhotoImgRight: 'smartphoto-img-right',
    smartPhotoList: 'smartphoto-list',
    smartPhotoListOnMove: 'smartphoto-list-onmove',
    smartPhotoHeader: 'smartphoto-header',
    smartPhotoCount: 'smartphoto-count',
    smartPhotoCaption: 'smartphoto-caption',
    smartPhotoDismiss: 'smartphoto-dismiss',
    smartPhotoLoader: 'smartphoto-loader',
    smartPhotoLoaderWrap: 'smartphoto-loader-wrap',
    smartPhotoImgClone: 'smartphoto-img-clone',
  },
  message: {
    gotoNextImage: 'go to the next image',
    gotoPrevImage: 'go to the previous image',
    closeDialog: 'close the image dialog',
  },
  arrows: true,
  nav: true,
  showAnimation: true,
  verticalGravity: false,
  useOrientationApi: false,
  useHistoryApi: true,
  swipeTopToClose: false,
  swipeBottomToClose: true,
  swipeOffset: 100,
  headerHeight: 60,
  footerHeight: 60,
  forceInterval: 10,
  registance: 0.5,
  loadOffset: 2,
  resizeStyle: 'fit',
  lazyAttribute: 'data-src',
};

var SmartPhoto =
  /*#__PURE__*/
  (function (_ATemplate) {
    _inherits(SmartPhoto, _ATemplate);

    function SmartPhoto(selector, settings) {
      var _this;

      _classCallCheck(this, SmartPhoto);

      _this = _possibleConstructorReturn(this, _getPrototypeOf(SmartPhoto).call(this));
      _this.data = util.extend({}, defaults, settings);
      _this.data.currentIndex = 0;
      _this.data.oldIndex = 0;
      _this.data.hide = true;
      _this.data.group = {};
      _this.data.scaleSize = 1;
      _this.data.scale = false;
      _this.pos = {
        x: 0,
        y: 0,
      };
      _this.data.photoPosX = 0;
      _this.data.photoPosY = 0;
      _this.handlers = [];
      _this.convert = {
        increment: _this.increment,
        virtualPos: _this.virtualPos,
        round: _this.round,
      };
      _this.data.groupItems = _this.groupItems;
      _this.elements =
        typeof selector === 'string' ? document.querySelectorAll(selector) : selector;
      var date = new Date();
      _this.tapSecond = date.getTime();
      _this.onListMove = false;
      _this.clicked = false;
      _this.id = _this._getUniqId();
      _this.vx = 0;
      _this.vy = 0;
      _this.data.appearEffect = null;

      _this.addTemplate(_this.id, template);

      _this.data.isSmartPhone = _this._isSmartPhone();
      var body = document.querySelector('body');
      util.append(body, "<div data-id='".concat(_this.id, "'></div>"));
      [].forEach.call(_this.elements, function (element) {
        _this.addNewItem(element);
      });

      _this.update();

      var currentItem = _this._getCurrentItemByHash();

      if (currentItem) {
        util.triggerEvent(currentItem.element, 'click');
      }

      _this.interval = setInterval(function () {
        _this._doAnim();
      }, _this.data.forceInterval);

      if (!_this.data.isSmartPhone) {
        var resizeHandler = function resizeHandler() {
          if (!_this.groupItems()) {
            return;
          }

          _this._resetTranslate();

          _this._setPosByCurrentIndex();

          _this._setSizeByScreen();

          _this.update();
        };

        var keydownHandler = function keydownHandler(e) {
          var code = e.keyCode || e.which;

          if (_this.data.hide === true) {
            return;
          }

          if (code === 37) {
            _this.gotoSlide(_this.data.prev);
          } else if (code === 39) {
            _this.gotoSlide(_this.data.next);
          } else if (code === 27) {
            _this.hidePhoto();
          }
        };

        window.addEventListener('resize', resizeHandler);
        window.addEventListener('keydown', keydownHandler);

        _this._registerRemoveEvent(window, 'resize', resizeHandler);

        _this._registerRemoveEvent(window, 'keydown', keydownHandler);

        return _possibleConstructorReturn(_this);
      }

      var orientationChangeHandler = function orientationChangeHandler() {
        if (!_this.groupItems()) {
          return;
        } // 画像の配置をリセット

        _this._resetTranslate();

        _this._setPosByCurrentIndex();

        _this._setHashByCurrentIndex();

        _this._setSizeByScreen();

        _this.update(); // orientationchangeが発火するタイミングとwindowのサイズが変化するタイミングが違うデバイスが存在する
        // その対策として、一定時間待機し、windowのサイズが変化しないかどうか確かめる
        // 変化した場合、もう一度画像の配置をリセットする

        var prevWidth = _this._getWindowWidth(); // 現在の画面サイズ

        var timeout = 500; // 最大待機時間

        var photoResizeAfterWindowSizeChange = function photoResizeAfterWindowSizeChange(time) {
          new Promise(function (resolve) {
            // 5ms秒待機
            setTimeout(function () {
              resolve();
            }, 25);
          }).then(function () {
            if (prevWidth !== _this._getWindowWidth()) {
              // windowのサイズが変化したら、画像の配置をリセット
              _this._resetTranslate();

              _this._setPosByCurrentIndex();

              _this._setHashByCurrentIndex();

              _this._setSizeByScreen();

              _this.update();
            } else if (time <= timeout) {
              // 待機時間内であれば再待機
              photoResizeAfterWindowSizeChange(time + 25);
            }
          });
        };

        photoResizeAfterWindowSizeChange(0); // 待機開始
      };

      window.addEventListener('orientationchange', orientationChangeHandler);

      _this._registerRemoveEvent(window, 'orientationchange', orientationChangeHandler);

      if (!_this.data.useOrientationApi) {
        return _possibleConstructorReturn(_this);
      }

      var deviceorientationHandler = function deviceorientationHandler(e) {
        var _window = window,
          orientation = _window.orientation;

        if (!e || !e.gamma || _this.data.appearEffect) {
          return;
        }

        if (
          !_this.isBeingZoomed &&
          !_this.photoSwipable &&
          !_this.data.elastic &&
          _this.data.scale
        ) {
          if (orientation === 0) {
            _this._calcGravity(e.gamma, e.beta);
          } else if (orientation === 90) {
            _this._calcGravity(e.beta, e.gamma);
          } else if (orientation === -90) {
            _this._calcGravity(-e.beta, -e.gamma);
          } else if (orientation === 180) {
            _this._calcGravity(-e.gamma, -e.beta);
          }
        }
      };

      window.addEventListener('deviceorientation', deviceorientationHandler);

      _this._registerRemoveEvent(window, 'deviceorientation', deviceorientationHandler);

      return _this;
    }

    _createClass(SmartPhoto, [
      {
        key: 'on',
        value: function on(event, fn) {
          var photo = this._getElementByClass(this.data.classNames.smartPhoto);

          var handler = function handler(e) {
            fn.call(photo, e);
          };

          photo.addEventListener(event, handler);

          this._registerRemoveEvent(photo, event, handler);
        },
      },
      {
        key: '_registerRemoveEvent',
        value: function _registerRemoveEvent(target, event, handler) {
          this.handlers.push({
            target: target,
            event: event,
            handler: handler,
          });
        },
      },
      {
        key: 'destroy',
        value: function destroy() {
          this.handlers.forEach(function (handler) {
            handler.target.removeEventListener(handler.event, handler.handler);
          });
          var wrapper = document.querySelector('[data-id="'.concat(this.id, '"]'));
          util.removeElement(wrapper);
          clearInterval(this.interval);
          this.removeTemplateEvents();
        },
      },
      {
        key: 'increment',
        value: function increment(item) {
          return item + 1;
        },
      },
      {
        key: 'round',
        value: function round(number) {
          return Math.round(number);
        },
      },
      {
        key: 'virtualPos',
        value: function virtualPos(pos) {
          pos = parseInt(pos, 10);

          var item = this._getSelectedItem();

          return pos / item.scale / this.data.scaleSize;
        },
      },
      {
        key: 'groupItems',
        value: function groupItems() {
          return this.data.group[this.data.currentGroup];
        },
      },
      {
        key: '_resetTranslate',
        value: function _resetTranslate() {
          var _this2 = this;

          var items = this.groupItems();
          items.forEach(function (item, index) {
            item.translateX = _this2._getWindowWidth() * index;
          });
        },
      },
      {
        key: 'addNewItem',
        value: function addNewItem(element) {
          var _this3 = this;

          var groupId = element.getAttribute('data-group') || 'nogroup';
          var group = this.data.group;

          if (groupId === 'nogroup') {
            element.setAttribute('data-group', 'nogroup');
          }

          if (!group[groupId]) {
            group[groupId] = [];
          }

          var index = group[groupId].length;
          var body = document.querySelector('body');
          var src = element.getAttribute('href');
          var img = element.querySelector('img');
          var thumb = src;

          if (img) {
            if (img.getAttribute(this.data.lazyAttribute)) {
              thumb = img.getAttribute(this.data.lazyAttribute);
            } else if (img.currentSrc) {
              thumb = img.currentSrc;
            } else {
              thumb = img.src;
            }
          }

          var item = {
            src: src,
            thumb: thumb,
            caption: element.getAttribute('data-caption'),
            groupId: groupId,
            translateX: this._getWindowWidth() * index,
            index: index,
            translateY: 0,
            width: 50,
            height: 50,
            id: element.getAttribute('data-id') || index,
            loaded: false,
            processed: false,
            element: element,
          };
          group[groupId].push(item);
          this.data.currentGroup = groupId;
          var id = element.getAttribute('data-id');

          if (!id) {
            element.setAttribute('data-id', index);
          }

          element.setAttribute('data-index', index);

          var clickHandler = function clickHandler(event) {
            event.preventDefault();
            _this3.data.currentGroup = element.getAttribute('data-group');
            _this3.data.currentIndex = parseInt(element.getAttribute('data-index'), 10);

            _this3._setHashByCurrentIndex();

            var currentItem = _this3._getSelectedItem();

            var onFocus = function onFocus(e) {
              var smartPhoto = document.querySelector(
                '.'.concat(_this3.data.classNames.smartPhoto)
              );
              var arrows = document.querySelector(
                '.'.concat(_this3.data.classNames.smartPhotoArrows)
              );
              var dismiss = document.querySelector(
                '.'.concat(_this3.data.classNames.smartPhotoDismiss)
              );
              var curFocus = document.activeElement;

              if (e.key === 9) {
                if (curFocus === smartPhoto) {
                  arrows.focus();
                } else if (curFocus === dismiss) {
                  smartPhoto.focus();
                }
              } else if (e.key === 9 && e.shiftKey) {
                if (curFocus === smartPhoto) {
                  dismiss.focus();
                } else if (curFocus === dismiss) {
                  smartPhoto.focus();
                }
              }
            };

            if (currentItem.loaded) {
              _this3._initPhoto();

              _this3.addAppearEffect(element, currentItem);

              _this3.clicked = true;

              _this3.update();

              body.style.overflow = 'hidden';

              _this3._fireEvent('open');

              var smartPhoto = document.querySelector(
                '.'.concat(_this3.data.classNames.smartPhoto)
              );
              smartPhoto.focus();
              document.addEventListener('keydown', onFocus);

              _this3._registerRemoveEvent(window, 'keydown', onFocus);
            } else {
              _this3._loadItem(currentItem).then(function () {
                _this3._initPhoto();

                _this3.addAppearEffect(element, currentItem);

                _this3.clicked = true;

                _this3.update();

                body.style.overflow = 'hidden';

                _this3._fireEvent('open');

                var smartPhoto = document.querySelector(
                  '.'.concat(_this3.data.classNames.smartPhoto)
                );
                smartPhoto.focus();
                document.addEventListener('keydown', onFocus);

                _this3._registerRemoveEvent(window, 'keydown', onFocus);
              });
            }
          };

          element.addEventListener('click', clickHandler);

          this._registerRemoveEvent(element, 'click', clickHandler);
        },
      },
      {
        key: '_initPhoto',
        value: function _initPhoto() {
          this.data.total = this.groupItems().length;
          this.data.hide = false;
          this.data.photoPosX = 0;
          this.data.photoPosY = 0;

          this._setPosByCurrentIndex();

          this._setSizeByScreen();

          this.setArrow();

          if (this.data.resizeStyle === 'fill' && this.data.isSmartPhone) {
            this.data.scale = true;
            this.data.hideUi = true;
            this.data.scaleSize = this._getScaleBoarder();
          }
        },
      },
      {
        key: 'onUpdated',
        value: function onUpdated() {
          var _this4 = this;

          if (this.data.appearEffect && this.data.appearEffect.once) {
            this.data.appearEffect.once = false;
            this.execEffect().then(function () {
              _this4.data.appearEffect = null;
              _this4.data.appear = true;

              _this4.update();
            });
          }

          if (this.clicked) {
            this.clicked = false;
            var classNames = this.data.classNames;

            var caption = this._getElementByClass(classNames.smartPhotoCaption);

            caption.focus();
          }
        },
      },
      {
        key: 'execEffect',
        value: function execEffect() {
          var _this5 = this;

          return new Promise(function (resolve) {
            if (util.isOldIE()) {
              resolve();
            }

            var _this5$data = _this5.data,
              appearEffect = _this5$data.appearEffect,
              classNames = _this5$data.classNames;

            var effect = _this5._getElementByClass(classNames.smartPhotoImgClone);

            var handler = function handler() {
              effect.removeEventListener('transitionend', handler, true);
              resolve();
            };

            effect.addEventListener('transitionend', handler, true);
            setTimeout(function () {
              effect.style.transform = 'translate('
                .concat(appearEffect.afterX, 'px, ')
                .concat(appearEffect.afterY, 'px) scale(')
                .concat(appearEffect.scale, ')');
            }, 10);
          });
        },
      },
      {
        key: 'addAppearEffect',
        value: function addAppearEffect(element, item) {
          if (this.data.showAnimation === false) {
            this.data.appear = true;
            return;
          }

          var img = element.querySelector('img');
          var pos = util.getViewPos(img);
          var appear = {};
          var scale = 1;
          appear.width = img.offsetWidth;
          appear.height = img.offsetHeight;
          appear.top = pos.top;
          appear.left = pos.left;
          appear.once = true;

          if (img.getAttribute(this.data.lazyAttribute)) {
            appear.img = img.getAttribute(this.data.lazyAttribute);
          } else {
            appear.img = item.src;
          }

          var toX = this._getWindowWidth();

          var toY = this._getWindowHeight();

          var screenY = toY - this.data.headerHeight - this.data.footerHeight;

          if (this.data.resizeStyle === 'fill' && this.data.isSmartPhone) {
            if (img.offsetWidth > img.offsetHeight) {
              scale = toY / img.offsetHeight;
            } else {
              scale = toX / img.offsetWidth;
            }
          } else {
            if (appear.width >= appear.height) {
              if (item.height < screenY) {
                scale = item.width / appear.width;
              } else {
                scale = screenY / appear.height;
              }
            } else if (appear.height > appear.width) {
              if (item.height < screenY) {
                scale = item.height / appear.height;
              } else {
                scale = screenY / appear.height;
              }
            }

            if (appear.width * scale > toX) {
              scale = toX / appear.width;
            }
          }

          var x = ((scale - 1) / 2) * img.offsetWidth + (toX - img.offsetWidth * scale) / 2;
          var y = ((scale - 1) / 2) * img.offsetHeight + (toY - img.offsetHeight * scale) / 2;
          appear.afterX = x;
          appear.afterY = y;
          appear.scale = scale;
          this.data.appearEffect = appear;
        },
      },
      {
        key: 'hidePhoto',
        value: function hidePhoto() {
          var _this6 = this;

          var dir = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'bottom';
          this.data.hide = true;
          this.data.appear = false;
          this.data.appearEffect = null;
          this.data.hideUi = false;
          this.data.scale = false;
          this.data.scaleSize = 1;
          var scrollX =
            window.pageXOffset !== undefined
              ? window.pageXOffset
              : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
          var scrollY =
            window.pageYOffset !== undefined
              ? window.pageYOffset
              : (document.documentElement || document.body.parentNode || document.body).scrollTop;
          var body = document.querySelector('body');

          if (window.location.hash) {
            this._setHash('');
          }

          window.scroll(scrollX, scrollY);

          this._doHideEffect(dir).then(function () {
            _this6.update();

            body.style.overflow = '';

            _this6._fireEvent('close');
          });
        },
      },
      {
        key: '_doHideEffect',
        value: function _doHideEffect(dir) {
          var _this7 = this;

          return new Promise(function (resolve) {
            if (util.isOldIE()) {
              resolve();
            }

            var classNames = _this7.data.classNames;

            var photo = _this7._getElementByClass(classNames.smartPhoto);

            var img = _this7._getElementByQuery('.current .'.concat(classNames.smartPhotoImg));

            var height = _this7._getWindowHeight();

            var handler = function handler() {
              photo.removeEventListener('transitionend', handler, true);
              resolve();
            };

            photo.style.opacity = 0;

            if (dir === 'bottom') {
              img.style.transform = 'translateY('.concat(height, 'px)');
            } else if (dir === 'top') {
              img.style.transform = 'translateY(-'.concat(height, 'px)');
            }

            photo.addEventListener('transitionend', handler, true);
          });
        },
      },
      {
        key: '_getElementByClass',
        value: function _getElementByClass(className) {
          return document.querySelector('[data-id="'.concat(this.id, '"] .').concat(className));
        },
      },
      {
        key: '_getElementByQuery',
        value: function _getElementByQuery(query) {
          return document.querySelector('[data-id="'.concat(this.id, '"] ').concat(query));
        },
      },
      {
        key: '_getTouchPos',
        value: function _getTouchPos() {
          var x = 0;
          var y = 0;
          var e = typeof event === 'undefined' ? this.e : event;

          if (this._isTouched(e)) {
            x = e.touches[0].pageX;
            y = e.touches[0].pageY;
          } else if (e.pageX) {
            x = e.pageX;
            y = e.pageY;
          }

          return {
            x: x,
            y: y,
          };
        },
      },
      {
        key: '_getGesturePos',
        value: function _getGesturePos(e) {
          var touches = e.touches;
          return [
            {
              x: touches[0].pageX,
              y: touches[0].pageY,
            },
            {
              x: touches[1].pageX,
              y: touches[1].pageY,
            },
          ];
        },
      },
      {
        key: '_setPosByCurrentIndex',
        value: function _setPosByCurrentIndex() {
          var _this8 = this;

          var items = this.groupItems();
          var moveX = -1 * items[this.data.currentIndex].translateX;
          this.pos.x = moveX;
          setTimeout(function () {
            _this8.data.translateX = moveX;
            _this8.data.translateY = 0;

            _this8._listUpdate();
          }, 1);
        },
      },
      {
        key: '_setHashByCurrentIndex',
        value: function _setHashByCurrentIndex() {
          var scrollX =
            window.pageXOffset !== undefined
              ? window.pageXOffset
              : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
          var scrollY =
            window.pageYOffset !== undefined
              ? window.pageYOffset
              : (document.documentElement || document.body.parentNode || document.body).scrollTop;
          var items = this.groupItems();
          var id = items[this.data.currentIndex].id;
          var group = this.data.currentGroup;
          var hash = 'group='.concat(group, '&photo=').concat(id);

          this._setHash(hash);

          window.scroll(scrollX, scrollY);
        },
      },
      {
        key: '_setHash',
        value: function _setHash(hash) {
          if (!(window.history && window.history.pushState) || !this.data.useHistoryApi) {
            return;
          }

          if (hash) {
            window.history.replaceState(
              null,
              null,
              ''.concat(location.pathname).concat(location.search, '#').concat(hash)
            );
          } else {
            window.history.replaceState(
              null,
              null,
              ''.concat(location.pathname).concat(location.search)
            );
          }
        },
      },
      {
        key: '_getCurrentItemByHash',
        value: function _getCurrentItemByHash() {
          var group = this.data.group;
          var hash = location.hash.substr(1);
          var hashObj = util.parseQuery(hash);
          var currentItem = null;

          var getCurrentItem = function getCurrentItem(item) {
            if (hashObj.group === item.groupId && hashObj.photo === item.id) {
              currentItem = item;
            }
          };

          Object.keys(group).forEach(function (key) {
            group[key].forEach(getCurrentItem);
          });
          return currentItem;
        },
      },
      {
        key: '_loadItem',
        value: function _loadItem(item) {
          return new Promise(function (resolve) {
            var img = new Image();

            img.onload = function () {
              item.width = img.width;
              item.height = img.height;
              item.loaded = true;
              resolve();
            };

            img.onerror = function () {
              resolve();
            };

            img.src = item.src;
          });
        },
      },
      {
        key: '_getItemByIndex',
        value: function _getItemByIndex(index) {
          var data = this.data;

          if (data.group[data.currentGroup][index]) {
            return data.group[data.currentGroup][index];
          }

          return null;
        },
      },
      {
        key: '_loadNeighborItems',
        value: function _loadNeighborItems() {
          var _this9 = this;

          var index = this.data.currentIndex;
          var loadOffset = this.data.loadOffset;
          var from = index - loadOffset;
          var to = index + loadOffset;
          var promises = [];

          for (var i = from; i < to; i++) {
            var item = this._getItemByIndex(i);

            if (item && !item.loaded) {
              promises.push(this._loadItem(item));
            }
          }

          if (promises.length) {
            Promise.all(promises).then(function () {
              _this9._initPhoto();

              _this9.update();
            });
          }
        },
      },
      {
        key: '_setSizeByScreen',
        value: function _setSizeByScreen() {
          var windowX = this._getWindowWidth();

          var windowY = this._getWindowHeight();

          var headerHeight = this.data.headerHeight;
          var footerHeight = this.data.footerHeight;
          var screenY = windowY - (headerHeight + footerHeight);
          var items = this.groupItems();
          items.forEach(function (item) {
            if (!item.loaded) {
              return;
            }

            item.processed = true;
            item.scale = screenY / item.height;

            if (item.height < screenY) {
              item.scale = 1;
            }

            item.x = ((item.scale - 1) / 2) * item.width + (windowX - item.width * item.scale) / 2;
            item.y =
              ((item.scale - 1) / 2) * item.height + (windowY - item.height * item.scale) / 2;

            if (item.width * item.scale > windowX) {
              item.scale = windowX / item.width;
              item.x = ((item.scale - 1) / 2) * item.width;
            }
          });
        },
      },
      {
        key: '_slideList',
        value: function _slideList() {
          var _this10 = this;

          this.data.scaleSize = 1;
          this.isBeingZoomed = false;
          this.data.hideUi = false;
          this.data.scale = false;
          this.data.photoPosX = 0;
          this.data.photoPosY = 0;
          this.data.onMoveClass = true;

          this._setPosByCurrentIndex();

          this._setHashByCurrentIndex();

          this._setSizeByScreen();

          setTimeout(function () {
            var item = _this10._getSelectedItem();

            _this10.data.onMoveClass = false;

            _this10.setArrow();

            _this10.update();

            if (_this10.data.oldIndex !== _this10.data.currentIndex) {
              _this10._fireEvent('change');
            }

            _this10.data.oldIndex = _this10.data.currentIndex;

            _this10._loadNeighborItems();

            if (!item.loaded) {
              _this10._loadItem(item).then(function () {
                _this10._initPhoto();

                _this10.update();
              });
            }
          }, 200);
        },
      },
      {
        key: 'gotoSlide',
        value: function gotoSlide(index) {
          if (this.e && this.e.preventDefault) {
            this.e.preventDefault();
          }

          this.data.currentIndex = parseInt(index, 10);

          if (!this.data.currentIndex) {
            this.data.currentIndex = 0;
          }

          this._slideList();
        },
      },
      {
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
        },
      },
      {
        key: 'beforeDrag',
        value: function beforeDrag() {
          if (this._isGestured(this.e)) {
            this.beforeGesture();
            return;
          }

          this.isBeingZoomed = false;

          if (this.data.scale) {
            this.beforePhotoDrag();
            return;
          }

          var pos = this._getTouchPos();

          this.isSwipable = true;
          this.dragStart = true;
          this.firstPos = pos;
          this.oldPos = pos;
        },
      },
      {
        key: 'afterDrag',
        value: function afterDrag() {
          var items = this.groupItems();
          var date = new Date();
          var tapSecond = date.getTime();
          var offset = this.tapSecond - tapSecond;
          var swipeWidth = 0;
          var swipeHeight = 0;
          this.isSwipable = false;
          this.onListMove = false;

          if (this.oldPos) {
            swipeWidth = this.oldPos.x - this.firstPos.x;
            swipeHeight = this.oldPos.y - this.firstPos.y;
          }

          if (this.isBeingZoomed) {
            this.afterGesture();
            return;
          }

          if (this.data.scale) {
            this.afterPhotoDrag();
            return;
          } else if (!util.isSmartPhone() && swipeWidth === 0 && swipeHeight === 0) {
            this.zoomPhoto();
            return;
          }

          if (Math.abs(offset) <= 500 && swipeWidth === 0 && swipeHeight === 0) {
            this.e.preventDefault();
            this.zoomPhoto();
            return;
          }

          this.tapSecond = tapSecond;

          this._fireEvent('swipeend');

          if (this.moveDir === 'horizontal') {
            if (swipeWidth >= this.data.swipeOffset && this.data.currentIndex !== 0) {
              this.data.currentIndex -= 1;
            } else if (
              swipeWidth <= -this.data.swipeOffset &&
              this.data.currentIndex !== items.length - 1
            ) {
              this.data.currentIndex += 1;
            }

            this._slideList();
          }

          if (this.moveDir === 'vertical') {
            if (this.data.swipeBottomToClose && swipeHeight >= this.data.swipeOffset) {
              this.hidePhoto('bottom');
            } else if (this.data.swipeTopToClose && swipeHeight <= -this.data.swipeOffset) {
              this.hidePhoto('top');
            } else {
              this.data.translateY = 0;

              this._slideList();
            }
          }
        },
      },
      {
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

          var pos = this._getTouchPos();

          var x = pos.x - this.oldPos.x;
          var y = pos.y - this.firstPos.y;

          if (this.dragStart) {
            this._fireEvent('swipestart');

            this.dragStart = false;

            if (Math.abs(x) > Math.abs(y)) {
              this.moveDir = 'horizontal';
            } else {
              this.moveDir = 'vertical';
            }
          }

          if (this.moveDir === 'horizontal') {
            this.pos.x += x;
            this.data.translateX = this.pos.x;
          } else {
            this.data.translateY = y;
          }

          this.onListMove = true;
          this.oldPos = pos;

          this._listUpdate();
        },
      },
      {
        key: 'zoomPhoto',
        value: function zoomPhoto() {
          var _this11 = this;

          this.data.hideUi = true;
          this.data.scaleSize = this._getScaleBoarder();

          if (this.data.scaleSize <= 1) {
            return;
          }

          this.data.photoPosX = 0;
          this.data.photoPosY = 0;

          this._photoUpdate();

          setTimeout(function () {
            _this11.data.scale = true;

            _this11._photoUpdate();

            _this11._fireEvent('zoomin');
          }, 300);
        },
      },
      {
        key: 'zoomOutPhoto',
        value: function zoomOutPhoto() {
          this.data.scaleSize = 1;
          this.isBeingZoomed = false;
          this.data.hideUi = false;
          this.data.scale = false;
          this.data.photoPosX = 0;
          this.data.photoPosY = 0;

          this._photoUpdate();

          this._fireEvent('zoomout');
        },
      },
      {
        key: 'beforePhotoDrag',
        value: function beforePhotoDrag() {
          var pos = this._getTouchPos();

          this.photoSwipable = true;

          if (!this.data.photoPosX) {
            this.data.photoPosX = 0;
          }

          if (!this.data.photoPosY) {
            this.data.photoPosY = 0;
          }

          this.oldPhotoPos = pos;
          this.firstPhotoPos = pos;
        },
      },
      {
        key: 'onPhotoDrag',
        value: function onPhotoDrag() {
          if (!this.photoSwipable) {
            return;
          }

          this.e.preventDefault();

          var pos = this._getTouchPos();

          var x = pos.x - this.oldPhotoPos.x;
          var y = pos.y - this.oldPhotoPos.y;

          var moveX = this._round(this.data.scaleSize * x, 6);

          var moveY = this._round(this.data.scaleSize * y, 6);

          if (typeof moveX === 'number') {
            this.data.photoPosX += moveX;
            this.photoVX = moveX;
          }

          if (typeof moveY === 'number') {
            this.data.photoPosY += moveY;
            this.photoVY = moveY;
          }

          this.oldPhotoPos = pos;

          this._photoUpdate();
        },
      },
      {
        key: 'afterPhotoDrag',
        value: function afterPhotoDrag() {
          if (this.oldPhotoPos.x === this.firstPhotoPos.x && this.photoSwipable) {
            this.photoSwipable = false;
            this.zoomOutPhoto();
          } else {
            this.photoSwipable = false;

            var item = this._getSelectedItem();

            var bound = this._makeBound(item);

            var offset = this.data.swipeOffset * this.data.scaleSize;
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

            if (this.data.photoPosX - bound.maxX > offset && this.data.currentIndex !== 0) {
              this.gotoSlide(this.data.prev);
              return;
            }

            if (
              bound.minX - this.data.photoPosX > offset &&
              this.data.currentIndex + 1 !== this.data.total
            ) {
              this.gotoSlide(this.data.next);
              return;
            } // todo
            // if(this.data.photoPosY - bound.maxY > offset) {
            //   this.hidePhoto();
            //   return;
            // }

            if (flagX === 0 && flagY === 0) {
              this.vx = this.photoVX / 5;
              this.vy = this.photoVY / 5;
            } else {
              this._registerElasticForce(flagX, flagY);
            }
          }
        },
      },
      {
        key: 'beforeGesture',
        value: function beforeGesture() {
          this._fireEvent('gesturestart');

          var pos = this._getGesturePos(this.e);

          var distance = this._getDistance(pos[0], pos[1]);

          this.isBeingZoomed = true;
          this.oldDistance = distance;
          this.data.scale = true;
          this.e.preventDefault();
        },
      },
      {
        key: 'onGesture',
        value: function onGesture() {
          var pos = this._getGesturePos(this.e);

          var distance = this._getDistance(pos[0], pos[1]);

          var size = (distance - this.oldDistance) / 100;
          var oldScaleSize = this.data.scaleSize;
          var posX = this.data.photoPosX;
          var posY = this.data.photoPosY;
          this.isBeingZoomed = true;
          this.data.scaleSize += this._round(size, 6);

          if (this.data.scaleSize < 0.2) {
            this.data.scaleSize = 0.2;
          } // todo

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
        },
      },
      {
        key: 'afterGesture',
        value: function afterGesture() {
          if (this.data.scaleSize > this._getScaleBoarder()) {
            return;
          }

          this.data.photoPosX = 0;
          this.data.photoPosY = 0;
          this.data.scale = false;
          this.data.scaleSize = 1;
          this.data.hideUi = false;

          this._fireEvent('gestureend');

          this._photoUpdate();
        },
      },
      {
        key: '_getForceAndTheta',
        value: function _getForceAndTheta(vx, vy) {
          return {
            force: Math.sqrt(vx * vx + vy * vy),
            theta: Math.atan2(vy, vx),
          };
        },
      },
      {
        key: '_getScaleBoarder',
        value: function _getScaleBoarder() {
          var item = this._getSelectedItem();

          var windowWidth = this._getWindowWidth();

          var windowHeight = this._getWindowHeight();

          if (!util.isSmartPhone()) {
            return 1 / item.scale;
          }

          if (item.width > item.height) {
            return windowHeight / (item.height * item.scale);
          }

          return windowWidth / (item.width * item.scale);
        },
      },
      {
        key: '_makeBound',
        value: function _makeBound(item) {
          var width = item.width * item.scale * this.data.scaleSize;
          var height = item.height * item.scale * this.data.scaleSize;
          var minX;
          var minY;
          var maxX;
          var maxY;

          var windowWidth = this._getWindowWidth();

          var windowHeight = this._getWindowHeight();

          if (windowWidth > width) {
            maxX = (windowWidth - width) / 2;
            minX = -1 * maxX;
          } else {
            maxX = (width - windowWidth) / 2;
            minX = -1 * maxX;
          }

          if (windowHeight > height) {
            maxY = (windowHeight - height) / 2;
            minY = -1 * maxY;
          } else {
            maxY = (height - windowHeight) / 2;
            minY = -1 * maxY;
          }

          return {
            minX: this._round(minX, 6) * this.data.scaleSize,
            minY: this._round(minY, 6) * this.data.scaleSize,
            maxX: this._round(maxX, 6) * this.data.scaleSize,
            maxY: this._round(maxY, 6) * this.data.scaleSize,
          };
        },
      },
      {
        key: '_registerElasticForce',
        value: function _registerElasticForce(x, y) {
          var _this12 = this;

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
            _this12.data.elastic = false;

            _this12._photoUpdate();
          }, 300);
        },
      },
      {
        key: '_getSelectedItem',
        value: function _getSelectedItem() {
          var data = this.data;
          var index = data.currentIndex;
          return data.group[data.currentGroup][index];
        },
      },
      {
        key: '_getUniqId',
        value: function _getUniqId() {
          return (Date.now().toString(36) + Math.random().toString(36).substr(2, 5)).toUpperCase();
        },
      },
      {
        key: '_getDistance',
        value: function _getDistance(point1, point2) {
          var x = point1.x - point2.x;
          var y = point1.y - point2.y;
          return Math.sqrt(x * x + y * y);
        },
      },
      {
        key: '_round',
        value: function _round(val, precision) {
          var digit = Math.pow(10, precision);
          val *= digit;
          val = Math.round(val);
          val /= digit;
          return val;
        },
      },
      {
        key: '_isTouched',
        value: function _isTouched(e) {
          if (e && e.touches) {
            return true;
          }

          return false;
        },
      },
      {
        key: '_isGestured',
        value: function _isGestured(e) {
          if (e && e.touches && e.touches.length > 1) {
            return true;
          }

          return false;
        },
      },
      {
        key: '_isSmartPhone',
        value: function _isSmartPhone() {
          var agent = navigator.userAgent;

          if (
            agent.indexOf('iPhone') > 0 ||
            agent.indexOf('iPad') > 0 ||
            agent.indexOf('ipod') > 0 ||
            agent.indexOf('Android') > 0
          ) {
            return true;
          }

          return false;
        },
      },
      {
        key: '_calcGravity',
        value: function _calcGravity(gamma, beta) {
          if (gamma > 5 || gamma < -5) {
            this.vx += gamma * 0.05;
          }

          if (this.data.verticalGravity === false) {
            return;
          }

          if (beta > 5 || beta < -5) {
            this.vy += beta * 0.05;
          }
        },
      },
      {
        key: '_photoUpdate',
        value: function _photoUpdate() {
          var classNames = this.data.classNames;

          var current = this._getElementByQuery('.current');

          var img = current.querySelector('.'.concat(classNames.smartPhotoImg));

          var nav = this._getElementByQuery('.'.concat(classNames.smartPhotoNav));

          var arrows = this._getElementByQuery('.'.concat(classNames.smartPhotoArrows));

          var photoPosX = this.virtualPos(this.data.photoPosX);
          var photoPosY = this.virtualPos(this.data.photoPosY);
          var scaleSize = this.data.scaleSize;
          var transform = 'translate('
            .concat(photoPosX, 'px,')
            .concat(photoPosY, 'px) scale(')
            .concat(scaleSize, ')');
          img.style.transform = transform;

          if (this.data.scale) {
            util.addClass(img, classNames.smartPhotoImgOnMove);
          } else {
            util.removeClass(img, classNames.smartPhotoImgOnMove);
          }

          if (this.data.elastic) {
            util.addClass(img, classNames.smartPhotoImgElasticMove);
          } else {
            util.removeClass(img, classNames.smartPhotoImgElasticMove);
          }

          if (this.data.hideUi) {
            if (nav) {
              nav.setAttribute('aria-hidden', 'true');
            }

            if (arrows) {
              arrows.setAttribute('aria-hidden', 'true');
            }
          } else {
            if (nav) {
              nav.setAttribute('aria-hidden', 'false');
            }

            if (arrows) {
              arrows.setAttribute('aria-hidden', 'false');
            }
          }
        },
      },
      {
        key: '_getWindowWidth',
        value: function _getWindowWidth() {
          if (document && document.documentElement) {
            return document.documentElement.clientWidth;
          } else if (window && window.innerWidth) {
            return window.innerWidth;
          }

          return 0;
        },
      },
      {
        key: '_getWindowHeight',
        value: function _getWindowHeight() {
          if (document && document.documentElement) {
            return document.documentElement.clientHeight;
          } else if (window && window.innerHeight) {
            return window.innerHeight;
          }

          return 0;
        },
      },
      {
        key: '_listUpdate',
        value: function _listUpdate() {
          var classNames = this.data.classNames;

          var list = this._getElementByQuery('.'.concat(classNames.smartPhotoList));

          var transform = 'translate('
            .concat(this.data.translateX, 'px,')
            .concat(this.data.translateY, 'px)');
          list.style.transform = transform; // $list

          if (this.data.onMoveClass) {
            util.addClass(list, classNames.smartPhotoListOnMove);
          } else {
            util.removeClass(list, classNames.smartPhotoListOnMove);
          }
        },
      },
      {
        key: '_fireEvent',
        value: function _fireEvent(eventName) {
          var photo = this._getElementByClass(this.data.classNames.smartPhoto);

          util.triggerEvent(photo, eventName);
        },
      },
      {
        key: '_doAnim',
        value: function _doAnim() {
          if (
            this.isBeingZoomed ||
            this.isSwipable ||
            this.photoSwipable ||
            this.data.elastic ||
            !this.data.scale
          ) {
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
        },
      },
    ]);

    return SmartPhoto;
  })(_aTemplate['default']);

exports['default'] = SmartPhoto;
module.exports = exports['default'];
