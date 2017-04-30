const Nightmare = require('nightmare');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const nightmare = Nightmare({
    webPreferences  : {
    partition : 'nopersist',
    preload: path.resolve(__dirname,'./preload.js')
  },
  show: true
});

const test_url = "file:///"+path.resolve(__dirname,"../examples/vanilla.html");
const hash_url = test_url + "#group=nogroup&photo=rhinoceros";

describe('test',function(){
  it('caption', (done) => {
    nightmare.goto(test_url)
      .click('[data-caption="lion"]')
      .click('.smartphoto-arrow-right')
      .wait(300)
      .evaluate(function () {
        return document.querySelector('.smartphoto-caption').innerText;
      })
      .then(function (result) {
        assert.equal(result,'camel');
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });

  it('hash', (done) => {
    nightmare.goto(hash_url)
      .wait(300)
      .evaluate(function () {
          return document.querySelector('.smartphoto-caption').innerText;
      })
      .then(function (result) {
        assert.equal(result,'rhinoceros');
        done();
      })
      .catch(function (error) {
        done(error);
      });
  });
});