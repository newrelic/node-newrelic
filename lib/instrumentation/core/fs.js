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

  var uninstrumented = [
    'write',
    'read'
  ]

  shim.record(
    fs,
    methods,
    recordFs
  )

  function recordFs(shim, fn, name) {
    return {name: NAMES.FS.PREFIX + name, callback: shim.LAST, recorder: record}
  }

  shim.record(
    fs.realpath,
    'native',
    function recordRealpathNative(shim, fn) {
      return recordFs(shim, fn, 'realpath.native')
    }
  )

  wrap(fs, 'fs', uninstrumented, agent.tracer.wrapFunctionNoSegment.bind(agent.tracer))
  wrap(fs, 'fs', ['watch'], wrapWatch)
  wrap(fs, 'fs', ['watchFile'], wrapWatchFile)

  function wrapWatch(fn) {
    return function wrappedWatch() {
      var args = agent.tracer.slice(arguments)
      var last = args.length - 1

      if (typeof args[last] === 'function') {
        var cb = args[last]
        args[last] = agent.tracer.bindFunction(cb)
      }

      return agent.tracer.bindEmitter(fn.apply(this, args))
    }
  }

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
