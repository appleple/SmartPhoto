"use strict"
const cmd = require('node-cmd');
const co = require('co');
const fs = require('fs-extra');
const pkg = require('../package.json');

const SystemPromise = (cmd_string) => {
  return new Promise((resolve, reject) => {
    cmd.get(
      cmd_string,
      (data, err, stderr) => {
        if ( err ) {
          console.log(err)
        }
        if ( stderr ) {
          console.log(stderr)
        }
        resolve(data)
      }
    )
  })
}

co(function *() {
  try {
    yield SystemPromise(`git add -A`);
    yield SystemPromise(`git commit -m "v${pkg.version}"`);
    yield SystemPromise(`git push origin v${pkg.version}`);
    yield SystemPromise(`git push origin master`);
    yield SystemPromise(`npm publish`);
  } catch ( err ) {
    console.log(err)
  }
});