'use strict'

var NAMES = require('../../metrics/names.js')


module.exports.ensurePartialName = ensurePartialName


// Ensures that partialName begins with the express prefix
// http instrumentation will set partialName before passing the request off to express
function ensurePartialName(trans) {
  if (!trans.partialName ||
      trans.partialName.lastIndexOf(NAMES.EXPRESS.PREFIX, 0) !== 0) {
    trans.partialName = NAMES.EXPRESS.PREFIX + trans.verb + NAMES.ACTION_DELIMITER + '/'
  }
}
