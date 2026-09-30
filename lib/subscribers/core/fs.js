/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseCoreSubscriber = require('./base')
const shimmer = require('../../shimmer')
const record = require('../../metrics/recorders/generic')
const NAMES = require('../../metrics/names')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

const FS_METHODS = [
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
  'ftruncate',
  'glob' // added in Node 22
]
const REALPATH_NATIVE = 'realpath.native'

class FsSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'fs', instrumentedMethods: [...FS_METHODS, REALPATH_NATIVE] })
  }

  handler(data, ctx) {
    return this.createSegment({ name: data.name, recorder: record, ctx })
  }

  /**
   * Wraps the callback-accepting fs methods, plus `realpath.native`. Calls
   * without a trailing callback are passed straight through rather than traced.
   *
   * @param {object} fs the `fs` core module
   */
  instrument(fs) {
    const self = this

    function wrapMethod(original, method) {
      const channel = tracingChannel(`${self.id}:${method}`)

      function wrappedMethod(...args) {
        const data = { name: NAMES.FS.PREFIX + method }
        return channel.traceCallback(original, -1, data, this, ...args)
      }

      // `shimmer.wrapMethod` only copies string-keyed enumerable properties
      // (e.g. via `Object.entries`), so Symbol-keyed ones like
      // `util.promisify.custom` on `fs.exists` need to be preserved here ourselves.
      for (const symbol of Object.getOwnPropertySymbols(original)) {
        wrappedMethod[symbol] = original[symbol]
      }

      return wrappedMethod
    }

    shimmer.wrapMethod(fs, 'fs', FS_METHODS, wrapMethod)

    // `realpath.native` was copied onto the wrapped `realpath` above, so it is
    // wrapped there to leave the original `realpath` untouched on unwrap.
    shimmer.wrapMethod(fs.realpath, 'fs.realpath', 'native', function wrapNative(original) {
      return wrapMethod(original, REALPATH_NATIVE)
    })
  }
}

module.exports = FsSubscriber
