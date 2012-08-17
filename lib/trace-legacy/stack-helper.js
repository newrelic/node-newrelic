'use strict';

function rawStack(error, frames) {
  return frames;
}

function getRawStack(error) {
  var prepareStackTrace;

  if (Error.prepareStackTrace) prepareStackTrace = Error.prepareStackTrace;

  try {
    error = error || new Error();
    Error.prepareStackTrace = rawStack;

    var stack = error.stack;
    if (stack) {
      if (Array.isArray(stack)) {
        return Array.prototype.slice.call(stack, 1);
      }
      else {
        return stack;
      }
    }
  }
  finally {
    if (prepareStackTrace) {
      Error.prepareStackTrace = prepareStackTrace;
    }
    else {
      delete Error.prepareStackTrace;
    }
  }
}

module.exports = getRawStack;
