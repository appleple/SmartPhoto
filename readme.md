# SmartPhoto
[![npm version](https://badge.fury.io/js/smartphoto.svg)](https://badge.fury.io/js/smartphoto)

The most easy to use responsive image viwer especially for mobile devices

## Feature
- zoom/drag images and also flick to next images
- Use Accelerometer to move images
- Scale images to fill/fit on the screen so to view each image clearly

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
const smartPhoto = require('smartphoto');
```

smartphoto.js
```js
window.addEventListener('load',function(){
    new smartPhoto(".js-img-viwer");
});
```

jquery-smartphoto.js
```js
$(function(){
    $(".js-img-viwer").smartPhoto();
});
```

### Basic Standalone Usage

```html
<a href="./assets/large-kuma.jpg" class="js-img-viwer" data-caption="くま" data-id="kuma">
  <img src="./assets/kuma.jpg" width="360" data-group="0"/>
</a>
<a href="./assets/large-rakuda.jpg" class="js-img-viwer" data-caption="ラクダ" data-id="rakuda">
  <img src="./assets/rakuda.jpg" width="360" data-group="0"/>
</a>
<a href="./assets/large-sai.jpg" class="js-img-viwer" data-caption="サイ" data-id="sai">
  <img src="./assets/sai.jpg" width="360" data-group="0"/>
</a>
<link rel="stylesheet" href="./css/smartphoto.min.css">
<script src="./js/smartphoto.js"></script>
<script>
window.addEventListener('load',function(){
  new smartPhoto(".js-img-viwer");
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
window.addEventListener('load',function(){
    new smartPhoto(".js-img-viwer",{
        arrows: false,
        nav: false
    });
});
```

#### Fit/Fill Option

You can choose if you want to scale images to fit/fill screen-width

```js
window.addEventListener('load',function(){
  new smartPhoto(".js-img-viwer",{
      resizeStyle: 'fit'
  });
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
