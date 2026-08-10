# SmartPhoto
[![npm version](https://badge.fury.io/js/smartphoto.svg)](https://badge.fury.io/js/smartphoto)
[![npm download](http://img.shields.io/npm/dm/smartphoto.svg)](https://www.npmjs.com/package/smartphoto)
[![GitHub license](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://raw.githubusercontent.com/appleple/SmartPhoto/master/LICENSE)

The most easy to use responsive image viewer especially for mobile devices

See [https://appleple.github.io/SmartPhoto/](https://appleple.github.io/SmartPhoto/) for complete docs and demos<br/>
If you are Japasese, See here [https://www.appleple.com/blog/javascript/smartphoto-js.html](https://www.appleple.com/blog/javascript/smartphoto-js.html) instead.

## Feature
- Intuitive gestures such as pinch-in/pinch-out/drag/swipe
- Use Accelerometer to move images
- Accessible from keyboards and screen-readers
- Show pictures via URL hash
- Can make photo groups

## Installation
- [npm](https://www.npmjs.com/package/smartphoto)
- [standalone](https://raw.githubusercontent.com/appleple/smart-photo/master/js/smartphoto.js)

via npm
```shell
npm install smartphoto --save
```

or yarn

```shell
yarn add smartphoto
```

## Usage
require
```js
const SmartPhoto = require('smartphoto');
```

smartphoto.js
```js
document.addEventListener('DOMContentLoaded',function(){
    new SmartPhoto(".js-smartphoto");
});
```

jquery-smartphoto.js
```js
$(function(){
    $(".js-smartphoto").SmartPhoto();
});
```

### Basic Standalone Usage

```html
<a href="./assets/large-bear.jpg" class="js-smartphoto" data-caption="bear" data-id="bear" data-group="0">
  <img src="./assets/bear.jpg" width="360"/>
</a>
<a href="./assets/large-camel.jpg" class="js-smartphoto" data-caption="camel" data-id="camel" data-group="0">
  <img src="./assets/camel.jpg" width="360"/>
</a>
<a href="./assets/large-rhinoceros.jpg" class="js-smartphoto" data-caption="rhinoceros" data-id="sai" data-group="0">
  <img src="./assets/rhinoceros.jpg" width="360"/>
</a>
<link rel="stylesheet" href="./css/smartphoto.min.css">
<script src="./js/smartphoto.js"></script>
<script>
document.addEventListener('DOMContentLoaded',function(){
  new SmartPhoto(".js-smartphoto");
});
</script>
```

### Programmatic usage (data source mode)

Instead of scanning `<a>` elements in the page, you can pass an array of slide objects directly (inspired by [yet-another-react-lightbox](https://yet-another-react-lightbox.com/)). This is useful when your images come from an API or a JS-rendered list.

```js
const photo = new SmartPhoto([
  { src: "/img/bear-large.jpg", thumb: "/img/bear.jpg", caption: "bear", id: "bear" },
  { src: "/img/camel-large.jpg", thumb: "/img/camel.jpg", caption: "camel", id: "camel", width: 1200, height: 800 },
]);

photo.show(0);       // open by index
photo.show("camel");  // or by id
photo.next();
photo.prev();
photo.hide();
photo.on("change", () => { /* ... */ }); // same event contract as HTML mode
```

Slide fields:

<table>
	<tr>
		<th>field</th>
		<th>required</th>
		<th>description</th>
	</tr>
	<tr>
		<td>src</td>
		<td>yes</td>
		<td>full-size image URL (equivalent to <code>href</code> in HTML mode)</td>
	</tr>
	<tr>
		<td>thumb</td>
		<td>no</td>
		<td>thumbnail URL used in the nav strip. Falls back to <code>src</code></td>
	</tr>
	<tr>
		<td>caption</td>
		<td>no</td>
		<td>caption text (equivalent to <code>data-caption</code>)</td>
	</tr>
	<tr>
		<td>alt</td>
		<td>no</td>
		<td>image alt text. Falls back to caption, then src</td>
	</tr>
	<tr>
		<td>id</td>
		<td>no</td>
		<td>identifier used by <code>show(id)</code> and the URL hash. Falls back to the index</td>
	</tr>
	<tr>
		<td>group</td>
		<td>no</td>
		<td>group name (equivalent to <code>data-group</code>). Falls back to <code>"nogroup"</code></td>
	</tr>
	<tr>
		<td>width / height</td>
		<td>no</td>
		<td>natural image size in px. When given, SmartPhoto skips the preload used to measure the image</td>
	</tr>
</table>

`show(indexOrId, options)` also accepts `options.group` (which group to open) and `options.trigger` (the element to animate from / return focus to). Both HTML mode and data source mode share the exact same public API, options, and events.

### Option

<table>
	<tr>
		<th>variable</th>
		<th>description</th>
		<th>default</th>
	</tr>
	<tr>
		<td>arrows</td>
		<td>prev/next arrows</td>
		<td>true</td>
	</tr>
	<tr>
		<td>nav</td>
		<td>navigation images at the bottom</td>
		<td>true</td>
	</tr>
	<tr>
		<td>showAnimation</td>
		<td>animate the open/close transition</td>
		<td>true</td>
	</tr>
	<tr>
		<td>verticalGravity</td>
		<td>apply device-tilt gravity to the vertical axis too (in addition to horizontal)</td>
		<td>false</td>
	</tr>
	<tr>
		<td>useOrientationApi</td>
		<td>use the accelerometer (deviceorientation) to move a zoomed image</td>
		<td>false</td>
	</tr>
	<tr>
		<td>useHistoryApi</td>
		<td>update the URL hash (<code>#group=…&photo=…</code>) via the History API</td>
		<td>true</td>
	</tr>
	<tr>
		<td>swipeTopToClose</td>
		<td>close the viewer on an upward swipe</td>
		<td>false</td>
	</tr>
	<tr>
		<td>swipeBottomToClose</td>
		<td>close the viewer on a downward swipe</td>
		<td>true</td>
	</tr>
	<tr>
		<td>swipeOffset</td>
		<td>minimum swipe distance (px) to trigger navigation/close</td>
		<td>100</td>
	</tr>
	<tr>
		<td>headerHeight</td>
		<td>height (px) reserved for the header when fitting images</td>
		<td>60</td>
	</tr>
	<tr>
		<td>footerHeight</td>
		<td>height (px) reserved for the footer when fitting images</td>
		<td>60</td>
	</tr>
	<tr>
		<td>resizeStyle</td>
		<td>resize images to fill/fit on the screen</td>
		<td>'fit'</td>
	</tr>
	<tr>
		<td>animationSpeed</td>
		<td>animation speed (ms) when switching/opening/closing images</td>
		<td>300</td>
	</tr>
	<tr>
		<td>forceInterval</td>
		<td>frequency (ms) to apply force to images</td>
		<td>10</td>
	</tr>
	<tr>
		<td>registance</td>
		<td>friction applied to the inertia scroll of a zoomed image</td>
		<td>0.5</td>
	</tr>
	<tr>
		<td>loadOffset</td>
		<td>number of neighboring slides to preload around the current one</td>
		<td>2</td>
	</tr>
	<tr>
		<td>lazyAttribute</td>
		<td>attribute read for a lazy-loaded thumbnail (HTML mode only)</td>
		<td>'data-src'</td>
	</tr>
	<tr>
		<td>classNames</td>
		<td>override any of the generated CSS class names</td>
		<td>see source</td>
	</tr>
	<tr>
		<td>message</td>
		<td>override screen-reader text (<code>gotoNextImage</code> / <code>gotoPrevImage</code> / <code>closeDialog</code> / <code>carouselLabel</code>)</td>
		<td>see source</td>
	</tr>
</table>

#### Hide parts
```js
document.addEventListener('DOMContentLoaded',function(){
    new SmartPhoto(".js-smartphoto",{
        arrows: false,
        nav: false
    });
});
```

#### Fit/Fill Option

You can choose if you want to scale images to fit/fill

```js
document.addEventListener('DOMContentLoaded',function(){
  new SmartPhoto(".js-smartphoto",{
      resizeStyle: 'fit'
  });
});
```

### Event

```js
// when the modal opened
photo.on('open',function(){
    console.log('open');
});
// when the modal closed
photo.on('close',function(){
    console.log('close');
});
// when all images are loaded
photo.on('loadall',function(){
    console.log('loadall');
});
// when photo is changed
photo.on('change',function(){
    console.log('change');
});
// when swipe started
photo.on('swipestart',function(){
    console.log('swipestart');
});
// when swipe ended
photo.on('swipeend',function(){
    console.log('swipeend');
});
// when zoomed in
photo.on('zoomin',function(){
    console.log('zoomin');
});
// when zoomed out
photo.on('zoomout',function(){
    console.log('zoomout');
});
```

### Methods

<table>
	<tr>
		<th>method</th>
		<th>description</th>
	</tr>
	<tr>
		<td><code>on(event, listener)</code></td>
		<td>subscribe to one of the events listed above</td>
	</tr>
	<tr>
		<td><code>destroy()</code></td>
		<td>remove the viewer and all of its event listeners</td>
	</tr>
	<tr>
		<td><code>[Symbol.dispose]()</code></td>
		<td>same as <code>destroy()</code>. Lets a <code>using</code> declaration destroy the instance automatically when it goes out of scope: <code>{ using photo = new SmartPhoto(...); }</code></td>
	</tr>
	<tr>
		<td><code>gotoSlide(index)</code></td>
		<td>go to the slide at <code>index</code> within the current group</td>
	</tr>
	<tr>
		<td><code>hidePhoto(dir?)</code></td>
		<td>close the viewer. <code>dir</code> is <code>'bottom'</code> (default) or <code>'top'</code> and controls the close animation direction</td>
	</tr>
	<tr>
		<td><code>zoomPhoto()</code> / <code>zoomOutPhoto()</code></td>
		<td>zoom the current image in/out programmatically</td>
	</tr>
	<tr>
		<td><code>addNewItem(element)</code></td>
		<td>register a new <code>&lt;a&gt;</code> thumbnail element (HTML mode)</td>
	</tr>
	<tr>
		<td><code>show(indexOrId?, options?)</code></td>
		<td>open the viewer, by index or id. Works in both HTML mode and data source mode. <code>options.group</code> picks the group; <code>options.trigger</code> sets the element to animate from and to return focus to</td>
	</tr>
	<tr>
		<td><code>hide()</code></td>
		<td>alias of <code>hidePhoto()</code></td>
	</tr>
	<tr>
		<td><code>next()</code> / <code>prev()</code></td>
		<td>go to the next/previous slide. No-op at the start/end of the group</td>
	</tr>
	<tr>
		<td><code>addItem(slideOrElement)</code></td>
		<td>add a new item. Accepts a slide object (data source mode) or an <code>Element</code> (HTML mode, same as <code>addNewItem</code>)</td>
	</tr>
	<tr>
		<td><code>currentIndex</code></td>
		<td>(getter) the index currently displayed within its group</td>
	</tr>
</table>

### CSS Custom Properties

<table>
	<tr>
		<th>property</th>
		<th>description</th>
		<th>default</th>
	</tr>
    <tr>
        <td>--smartphoto-animation-speed</td>
        <td>animation speed when switching/opening/closing images. Overridden per-instance by the <code>animationSpeed</code> JS option</td>
        <td>300ms</td>
    </tr>
    <tr>
        <td>--smartphoto-animation-function</td>
        <td>easing function used for animations</td>
        <td>ease-out</td>
    </tr>
    <tr>
        <td>--smartphoto-backdrop-color</td>
        <td>backdrop color when viewing images</td>
        <td>rgba(0, 0, 0, 1)</td>
    </tr>
    <tr>
        <td>--smartphoto-header-color</td>
        <td>header color</td>
        <td>rgba(0, 0, 0, .2)</td>
    </tr>
</table>

Set these on `.smartphoto` (or `:root`) to override the defaults, no rebuild required:

```css
.smartphoto {
  --smartphoto-animation-speed: 500ms;
  --smartphoto-animation-function: ease-in-out;
  --smartphoto-backdrop-color: rgba(0, 0, 0, 0.9);
  --smartphoto-header-color: rgba(0, 0, 0, 0.4);
}
```


## Download
[Download ZIP](https://github.com/appleple/SmartPhoto/archive/master.zip)

## Github
[https://github.com/appleple/SmartPhoto](https://github.com/appleple/SmartPhoto)

## License
Code and documentation copyright 2017 by appleple, Inc. Code released under the [MIT License](https://github.com/appleple/SmartPhoto/blob/master/LICENSE).
