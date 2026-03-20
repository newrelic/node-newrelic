/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const QNextTick = require('./next-tick')

module.exports = class QRunAfter extends QNextTick {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_runAfter' })
  }
}
