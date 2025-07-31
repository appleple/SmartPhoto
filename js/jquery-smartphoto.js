var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var require_jquery_smartphoto = __commonJS({
  "jquery-smartphoto.js"(exports, module) {
    const SmartPhoto = require("../index");
    let jq;
    const applyJQuery = (jQuery) => {
      jQuery.fn.SmartPhoto = function(settings) {
        if (typeof settings === "string") ;
        else {
          new SmartPhoto(this, settings);
        }
        return this;
      };
    };
    if (typeof define === "function" && define.amd) {
      define(["jquery"], applyJQuery);
    } else {
      jq = window.jQuery ? window.jQuery : window.$;
      if (typeof jq !== "undefined") {
        applyJQuery(jq);
      }
    }
    module.exports = applyJQuery;
  }
});
export default require_jquery_smartphoto();
