'use strict'

module.exports = initialize

function initialize(agent, inspector, name, shim) {
  var sessionProto = inspector && inspector.Session && inspector.Session.prototype
  if (!sessionProto) {
    return false
  }

  shim.wrap(
    sessionProto,
    'post',
    function wrapPost(shim, fn) {
      return function wrappedPost() {
        var args = shim.argsToArray.apply(shim, arguments)
        shim.bindCallbackSegment(args, shim.LAST)
        return fn.apply(this, args)
      }
    }
  )
}
