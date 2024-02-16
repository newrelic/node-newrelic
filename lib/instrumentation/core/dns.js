/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { RecorderSpec } = require('../../../lib/shim/specs')

module.exports = initialize

function initialize(agent, dns, moduleName, shim) {
  const methods = [
    'lookup',
    'resolve',
    'resolve4',
    'resolve6',
    'resolveCname',
    'resolveMx',
    'resolveNaptr',
    'resolveNs',
    'resolvePtr',
    'resolveSrv',
    'resolveTxt',
    'reverse'
  ]

  shim.record(dns, methods, function recordDnsMethod(shim, fn, name) {
    return new RecorderSpec({ name: 'dns.' + name, callback: shim.LAST })
  })
}
