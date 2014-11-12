'use strict'

var wrap = require('../../shimmer').wrapMethod

module.exports = initialize

var methods = [
  'deflate',
  'deflateRaw',
  'gzip',
  'gunzip',
  'inflate',
  'inflateRaw',
  'unzip',
]

function initialize(agent, zlib) {
  if (zlib.Deflate && zlib.Deflate.prototype) {
    var proto = Object.getPrototypeOf(zlib.Deflate.prototype)
    if (proto._transform) {
      // streams2
      wrap(proto, 'zlib', '_transform', bind)
    } else if (proto.write && proto.flush && proto.end) {
      // plain ol' streams
      wrap(proto, 'zlib', ['write', 'flush', 'end'], bind)
    }
  }

  wrap(zlib, 'zlib', methods, segment)

  function bind(fn) {
    return agent.tracer.wrapFunctionNoSegment(fn)
  }

  function segment(fn, method) {
    return agent.tracer.wrapFunctionLast('zlib.' + method, null, fn)
  }
}
