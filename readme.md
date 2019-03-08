# SmartPhoto
[![npm version](https://badge.fury.io/js/smartphoto.svg)](https://badge.fury.io/js/smartphoto)
[![CircleCI](https://circleci.com/gh/appleple/SmartPhoto/tree/master.svg?style=shield)](https://circleci.com/gh/appleple/SmartPhoto/tree/master)
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
		<td>useOrientationApi</td>
		<td>use accelerometer to move images</td>
		<td>true</td>
	</tr>
	<tr>
		<td>resizeStyle</td>
		<td>resize images to fill/fit on the screen</td>
		<td>'fill'</td>
	</tr>
	<tr>
		<td>animationSpeed</td>
		<td>animation speed when switching images</td>
		<td>300</td>
	</tr>
	<tr>
		<td>forceInterval</td>
		<td>frequency to apply force to images</td>
		<td>10</td>
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

### SCSS

<table>
	<tr>
		<th>variable</th>
		<th>description</th>
		<th>default</th>
	</tr>
    <tr>
        <td>$animation-speed</td>
        <td>animation speed when switching images</td>
        <td>.3s</td>
    </tr>
    <tr>
        <td>$backdrop-color</td>
        <td>backdrop color when viewing images</td>
        <td>rgba(0, 0, 0, 1)</td>
    </tr>
    <tr>
        <td>$header-color</td>
        <td>header color</td>
        <td>rgba(0, 0, 0, .2)</td>
    </tr>
</table>


## Download
[Download ZIP](https://github.com/appleple/SmartPhoto/archive/master.zip)

## Github
[https://github.com/appleple/SmartPhoto](https://github.com/appleple/SmartPhoto)

## Contributor
[@steelydylan](https://github.com/steelydylan)

## License
Code and documentation copyright 2017 by appleple, Inc. Code released under the [MIT License](https://github.com/appleple/SmartPhoto/blob/master/LICENSE).
