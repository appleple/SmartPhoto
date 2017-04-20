# SmartPhoto
The most easy to use responsive image viwer especially for mobile devices

## Feature
- Flick images to zoom/drag images and also switch to next images
- Use Accelerometer to move images
- Scale images to the optimized size so to view each image clearly

## Instration
- [npm](https://www.npmjs.com/package/smartphoto)
- [standalone](https://raw.githubusercontent.com/appleple/smart-photo/master/js/smart-photo.js)

via npm
```shell
npm install smartphoto --save
```

or

```shell
yarn add smartphoto
```

## Usage
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


## Download
[Download ZIP](https://github.com/appleple/SmartPhoto/archive/master.zip)

## Github
[https://github.com/appleple/SmartPhoto](https://github.com/appleple/SmartPhoto)

## License
Code and documentation copyright 2017 by appleple, Inc. Code released under the [MIT License](https://github.com/appleple/SmartPhoto/blob/master/LICENSE).