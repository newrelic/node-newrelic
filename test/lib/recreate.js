'use strict';

var path   = require('path')
  , fs     = require('fs')
  , exists = (fs.existsSync || path.existsSync)
  , wrench = require('wrench')
  ;

module.exports = function recreate(prefix, subdir) {
  var dir = path.join(prefix, subdir);

  if (exists(dir)) wrench.rmdirSyncRecursive(dir);
  wrench.mkdirSyncRecursive(dir, '0755');
};
