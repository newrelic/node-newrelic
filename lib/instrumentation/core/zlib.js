'use strict'

const recorder = require('../../metrics/recorders/generic')

module.exports = initialize

var methods = [
  'deflate',
  'deflateRaw',
  'gzip',
  'gunzip',
  'inflate',
  'inflateRaw',
  'unzip'
]

function initialize(agent, zlib, moduleName, shim) {
  shim.record(zlib, methods, recordZLib)

  if (zlib.Deflate && zlib.Deflate.prototype) {
    var proto = Object.getPrototypeOf(zlib.Deflate.prototype)
    if (proto._transform) {
      // streams2
      shim.wrap(proto, '_transform', wrapNoSegment)
    } else if (proto.write && proto.flush && proto.end) {
      // plain ol' streams
      shim.wrap(proto, ['write', 'flush', 'end'], wrapNoSegment)
    }
  }

  function recordZLib(shim, fn, name) {
    return {name: `zlib.${name}`, callback: shim.LAST, recorder}
  }
}

function wrapNoSegment(shim, fn) {
  return function wrappedZLibNoSegment() {
    if (!shim.getActiveSegment()) {
      return fn.apply(this, arguments)
    }

    const args = shim.argsToArray.apply(shim, arguments)
    const cbIndex = args.length - 1

    shim.bindSegment(args, cbIndex)

    return fn.apply(this, args)
  }
}
