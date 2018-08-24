'use strict'

const record = require('../../metrics/recorders/generic')
const NAMES = require('../../metrics/names')
const wrap = require('../../shimmer').wrapMethod

module.exports = initialize

function initialize(agent, fs, moduleName, shim) {
  const methods = [
    'rename',
    'truncate',
    'chown',
    'lchown',
    'fchown',
    'chmod',
    'lchmod',
    'fchmod',
    'stat',
    'lstat',
    'fstat',
    'link',
    'symlink',
    'readlink',
    'realpath',
    'unlink',
    'rmdir',
    'mkdir',
    'mkdtemp',
    'readdir',
    'close',
    'open',
    'utimes',
    'futimes',
    'fsync',
    'readFile',
    'writeFile',
    'appendFile',
    'exists',
    'ftruncate'
  ]

  const nonRecordedMethods = [
    'write',
    'read'
  ]

  shim.record(fs, methods, recordFs)

  const originalExists = shim.getOriginal(fs.exists)
  Object.getOwnPropertySymbols(originalExists).forEach((symbol) => {
    fs.exists[symbol] = originalExists[symbol]
  })

  fs.realpath.native = shim.getOriginal(fs.realpath).native

  shim.record(
    fs.realpath,
    'native',
    function recordRealpathNative(shim, fn) {
      return recordFs(shim, fn, 'realpath.native')
    }
  )

  shim.wrap(
    fs,
    nonRecordedMethods,
    function wrapNonRecordedFs(shim, fn) {
      return function wrappedNonRecordedFs() {
        // these are called in tight loops so opting out early
        if (!shim.getActiveSegment()) {
          return fn.apply(this, arguments)
        }

        const args = shim.argsToArray.apply(shim, arguments)
        const cbIndex = args.length - 1

        shim.bindSegment(args, cbIndex)

        return fn.apply(this, args)
      }
    }
  )

  function recordFs(shim, fn, name) {
    return {name: NAMES.FS.PREFIX + name, callback: shim.LAST, recorder: record}
  }

  shim.wrap(
    fs,
    ['watch'],
    function wrapFsWatch(shim, fn) {
      return function wrappedFsWatch() {
        const args = shim.argsToArray.apply(shim, arguments)
        const cbIndex = args.length - 1

        shim.bindSegment(args, cbIndex)

        const result = fn.apply(this, args)
        shim.bindSegment(result, 'emit')

        return result
      }
    }
  )

  wrap(fs, 'fs', ['watchFile'], wrapWatchFile)

  function wrapWatchFile(fn) {
    return function wrappedWatchFile() {
      var args = agent.tracer.slice(arguments)
      var last = args.length - 1

      if (typeof args[last] === 'function') {
        var cb = args[last]
        args[last] = agent.tracer.bindFunction(cb)
        // allow unwatchFile to work despite cb being wrapped
        args[last].listener = cb
      }

      return fn.apply(this, args)
    }
  }
}
