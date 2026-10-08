/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const BaseCoreSubscriber = require('./base')
const { wrapMethod, wrapMethods } = require('../wrap-method')
const record = require('../../metrics/recorders/generic')
const NAMES = require('../../metrics/names')
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { tracingChannel } = require('node:diagnostics_channel')

const FS_METHODS = [
  'appendFile',
  'chmod',
  'chown',
  'close',
  'exists',
  'fchmod',
  'fchown',
  'fstat',
  'fsync',
  'ftruncate',
  'futimes',
  'glob',
  'lchmod',
  'lchown',
  'link',
  'lstat',
  'mkdir',
  'mkdtemp',
  'open',
  'readFile',
  'readdir',
  'readlink',
  'realpath',
  'rename',
  'rmdir',
  'stat',
  'symlink',
  'truncate',
  'unlink',
  'utimes',
  'writeFile',
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
    const id = this.id

    function methodWrapper(original, method) {
      const channel = tracingChannel(`${id}:${method}`)

      function wrappedMethod(...args) {
        const data = { name: NAMES.FS.PREFIX + method }
        return channel.traceCallback(original, -1, data, this, ...args)
      }

      return wrappedMethod
    }

    wrapMethods({
      module: fs,
      methodNames: FS_METHODS,
      logger: this.logger,
      wrapper: methodWrapper
    })

    // `realpath.native` was copied onto the wrapped `realpath` above, so it is
    // wrapped there to leave the original `realpath` untouched on unwrap.
    wrapMethod({
      module: fs.realpath,
      methodName: 'native',
      logger: this.logger,
      wrapper: function wrapNative(original) {
        return methodWrapper(original, REALPATH_NATIVE)
      }
    })
  }
}

module.exports = FsSubscriber
