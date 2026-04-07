'use strict'

const UNKNOWN = 'Unknown'

function getWrapper(shim, original, name, descriptor) {
  const wrapped = shim.wrap(original, function wrapOriginal(shim, original, name, args) {
    const transaction = shim.getActiveTransaction()
    if (transaction && transaction.ignored) {
      return original.apply(this, args)
    }

    let segment
    const parameters = descriptor.parameters || null
    const callback = shim.normalizeIndex(args.length - 1, args)
    if (shim.isFunction(callback) && !shim.isWrapped(callback)) {
      segment = shim.createSegment(name, descriptor.recorder, parameters)
      if (segment) {
        segment.start()
        args[callback.index] = shim.bindSegment(callback, segment, true)
      }
    } else if (descriptor.callback) {
      segment = shim.createSegment(name, descriptor.recorder, parameters)
      if (segment) {
        segment.start()
      }
    } else {
      segment = shim.createSegment(name, descriptor.recorder, parameters)
      if (segment) {
        segment.async = false
      }
    }

    let result
    try {
      result = original.apply(this, args)
    } catch (err) {
      if (segment) {
        segment.end()
      }
      throw err
    }

    if (segment && segment.async !== false) {
      shim.logger.trace('Created segment %s but did not end it.', name)
    } else if (segment) {
      segment.end()
    }

    return result
  })

  wrapped.__NR_original = original
  return wrapped
}

module.exports = {
  UNKNOWN,
  getWrapper
}
