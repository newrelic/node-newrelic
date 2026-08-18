/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const recorder = require('../../metrics/recorders/generic')
const { RecorderSpec } = require('../../shim/specs')

module.exports = initialize

const methods = ['deflate', 'deflateRaw', 'gzip', 'gunzip', 'inflate', 'inflateRaw', 'unzip']

function initialize(agent, zlib, moduleName, shim) {
  shim.record(zlib, methods, recordZLib)

  function recordZLib(shim, fn, name) {
    return new RecorderSpec({ name: `zlib.${name}`, callback: shim.LAST, recorder })
  }
}
