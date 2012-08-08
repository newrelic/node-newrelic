'use strict';

function rawStack(error, structuredStackTrace) {
  return structuredStackTrace;
}

function getRawStack(error) {
  var prepareStackTrace = Error.prepareStackTrace;
  try {
    error = error || new Error();
    Error.prepareStackTrace = rawStack;
    var stack = error.stack;
    if (Array.isArray(stack)) {
      return Array.prototype.slice.call(stack, 1);
    }
    else {
      return stack;
    }
  }
  finally {
    Error.prepareStackTrace = prepareStackTrace;
  }
}

module.exports = getRawStack;
