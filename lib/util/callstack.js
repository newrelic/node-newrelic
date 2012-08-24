'use strict';

var path = require('path')
  , getRawStack = require(path.join(__dirname, 'raw-stack'))
  , logger = require(path.join(__dirname, '..', 'logger'))
  ;

var callstack = module.exports = {
  annotateFunction : function (funktion, name, value) {
    if (funktion && name) {
      funktion[name] = value;
    }
  },

  /**
   * The "caller" is typically going to be the parent of the function
   * invoking findCaller, so by default return the function 2 up the call
   * stack from findCaller.
   *
   * @param {Number} height How far up the call stack above findCaller's
   *                        caller to crawl. Defaults to 1.
   */
  findCaller : function findCaller(height) {
    if (!height && height !== 0) height = 1;
    height += 1;

    var frames = getRawStack();
    if (!frames) return logger.debug("Unable to get raw stack frames. " +
                                     "Transaction traces won't work.");

    if (frames[height]) return frames[height].fun;
  },

  /**
   * Attach a property to the calling function.
   *
   * @param {Number} height How far up the calls tack to crawl. Defaults to 1.
   */
  annotateCaller : function annotateCaller(name, value, height) {
    var caller = callstack.findCaller(height);

    if (caller) {
      callstack.annotateFunction(caller, name, value);
    }
    else {
      logger.debug("Unable to find caller. Transaction traces won't work.");
    }
  },

  /**
   * Crawl the call stack from the bottom up, looking for an annotation with
   * a given name. If it's found, return the value assigned to the annotation.
   *
   * @param {string} name The name of the property to be found.
   * @returns {Object} Whatever was associated with that scope on the calling function.
   */
  findAnnotation : function findAnnotation(name) {
    var frames = getRawStack();
    if (!frames) return logger.debug("Unable to get raw stack frames. " +
                                     "Transaction traces won't work.");

    for (var i = 0; i < frames.length; i++) {
      if (frames[i] && frames[i].fun && frames[i].fun[name]) {
        return frames[i].fun[name];
      }
    }
  }
};
