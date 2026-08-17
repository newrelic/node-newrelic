/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { INSTRUMENTED_METHODS } = require('./constants')
const BaseCoreSubscriber = require('../base')

class DnsPromisesSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'dns', prefix: 'promises', instrumentedMethods: INSTRUMENTED_METHODS })
  }
}

module.exports = DnsPromisesSubscriber
