#! /usr/bin/env node
var fs = require("fs");
var jsesc = require("jsesc");
var process_path = process.cwd();
var path = require('path');
var text = fs.readFileSync(path.resolve(process_path, "./src/index.js"), 'utf8');
text = text.replace(/import (.*?) from '((.*?)\.(html|css))'/g,function(a,b,c){
  var template = jsesc(fs.readFileSync(path.resolve(process_path,"./src/",c), 'utf8'));
	return "var "+ b +" = \'"+template+"\'";
});
fs.writeFileSync(path.resolve(process_path,"./lib/prebuild.js"),text, 'utf8');