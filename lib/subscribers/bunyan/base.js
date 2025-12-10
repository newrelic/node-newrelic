/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const ApplicationLogsSubscriber = require('../application-logs')

class BunyanBaseSubscriber extends ApplicationLogsSubscriber {
  NAME_FROM_LEVEL = {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal'
  }

  constructor({ agent, logger, channelName }) {
    super({ agent, logger, packageName: 'bunyan', channelName })
  }
}

module.exports = BunyanBaseSubscriber
