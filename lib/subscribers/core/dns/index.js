/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { INSTRUMENTED_METHODS } = require('./constants')
const BaseCoreSubscriber = require('../base')

class DnsSubscriber extends BaseCoreSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'dns', instrumentedMethods: INSTRUMENTED_METHODS, hasCallback: true })
  }
}

module.exports = DnsSubscriber
