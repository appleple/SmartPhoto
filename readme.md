# SmartPhoto
The most easy to use responsive image viwer especially for mobile devices

## Feature
- Flick images to zoom/drag images and also switch to next images
- Use Accelerometer to move images
- Scale images to the optimized size so to view each image clearly

## Instration
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
smartphoto.js

```js
window.addEventListener('load',function(){
    new smartPhoto(".js-img-viwer",{
        arrows: false,

    });
});
```

jquery-smartphoto.js
```js
$(function(){
    $(".js-img-viwer").smartPhoto();
});
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
		<td>scaleOnClick</td>
		<td>scale images to optimized sizes when tapped</td>
		<td>true</td>
	</tr>
	<tr>
		<td>useOrientationApi</td>
		<td>use accelerometer to move images</td>
		<td>true</td>
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

When you want to hide arrows and nav
```js
window.addEventListener('load',function(){
    new smartPhoto(".js-img-viwer",{
        arrows: false,
        nav: false
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

## License
Code and documentation copyright 2017 by appleple, Inc. Code released under the [MIT License](https://github.com/appleple/SmartPhoto/blob/master/LICENSE).