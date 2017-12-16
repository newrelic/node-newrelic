'use strict'

exports.wrapClass = wrapClass

/**
* Wraps an es6-style class using a subclass.
*
* - `wrapClass(shim, Base, fnName, spec, args)`
*
* @private
*
* @param {Shim} shim
*  The shim performing the wrapping/binding.
*
* @param {class} Base
*  The es6 class to be wrapped.
*
* @param {string} fnName
*  The name of the base class.
*
* @param {ClassWrapSpec} spec
*  The spec with pre- and post-execution hooks to call.
*
* @param {Array.<*>} args
*  Extra arguments to pass through to the pre- and post-execution hooks.
*
* @return {class} A class that extends Base with execution hooks.
 */
function wrapClass(shim, Base, fnName, spec, args) {
  return class WrappedClass extends Base {
    constructor() {
      var cnstrctArgs = shim.argsToArray.apply(shim, arguments)
      // Assemble the arguments to hand to the spec.
      var _args = [shim, Base, fnName, cnstrctArgs]
      if (args.length > 0) {
        _args.push.apply(_args, args)
      }

      // Call the spec's before hook, then call the base constructor, then call
      // the spec's after hook.
      spec.pre && spec.pre.apply(null, _args)
      super(...cnstrctArgs)
      spec.post && spec.post.apply(this, _args)
    }
  }
}
