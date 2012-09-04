'use strict';

var path        = require('path')
  , getRawStack = require(path.join(__dirname, 'raw-stack'))
  , logger      = require(path.join(__dirname, '..', 'logger'))
  ;

var NR_TRANSACTION_NAME = '__NR__transaction';

var callstack = module.exports = {
  /**
   * Attach a transaction to a function in the call stack. Once the function
   * annotated, it can be found by searching up the call stack, and the
   * transaction can be passed around by the instrumentation.
   *
   * Also registers the function on the transaction's list of places
   * it's been attached, for later cleanup.
   *
   * @param {Function} funktion The function to be annotated.
   * @param {Transaction} transaction The transaction to be attached.
   */
  annotateFunction : function annotateFunction(funktion, transaction) {
    if (!funktion instanceof Function) {
      return logger.debug("Tried to propagate a transaction onto a non-function.");
    }

    if (funktion) {
      funktion[NR_TRANSACTION_NAME] = transaction;

      if (transaction && transaction.addCallSite) transaction.addCallSite(funktion);
    }
  },

  getAnnotation : function getAnnotation(funktion) {
    return funktion[NR_TRANSACTION_NAME];
  },

  /**
   * Using a list (meant to be stored on the transaction), clear the given
   * transaction from all of the functions in the list.
   *
   * Note that this function will only clear the provided transaction --
   * it checks to ensure they're the same before deleting.
   *
   * @param {Transaction} transaction The transaction to be detached.
   * @param {Array} funktions The list of functions to be cleared.
   */
  clearAnnotations : function clearAnnotations(transaction, funktions) {
    funktions.forEach(function (funktion) {
      // err on the side of safety
      if (funktion[NR_TRANSACTION_NAME] === transaction) {
        delete funktion[NR_TRANSACTION_NAME];
      }
    });
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

    // don't go off the end of the call stack
    height = Math.min(height, frames.length - 1);
    if (frames[height]) return frames[height].fun;
  },

  /**
   * Attach a property to the calling function.
   *
   * @param {Number} height How far up the call stack to crawl. Defaults to 1.
   */
  annotateCaller : function annotateCaller(value, height) {
    var caller = callstack.findCaller(height);

    if (caller) {
      var annotation = callstack.getAnnotation(caller);
      if (annotation) {
        if (value === annotation) {
          return logger.verbose("This transaction is already on the call stack.");
        }
        else {
          return logger.warn("Instrumentation error: " +
                             "Two transactions tried to annotate the same caller.");
        }
      }

      callstack.annotateFunction(caller, value);
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
  findAnnotation : function findAnnotation() {
    var frames = getRawStack();
    if (!frames) return logger.debug("Unable to get raw stack frames. " +
                                     "Transaction traces won't work.");

    for (var i = 0; i < frames.length; i++) {
      if (frames[i] && frames[i].fun && frames[i].fun[NR_TRANSACTION_NAME]) {
        return frames[i].fun[NR_TRANSACTION_NAME];
      }
    }
  }
};
