/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbSubscriber = require('../db.js')

class MySqlSubscriber extends DbSubscriber {
  constructor({ agent, logger, packageName = 'mysql', channelName = 'nr_channel', system = 'mysql' }) {
    super({ agent, logger, packageName, channelName, system })
  }
}

class MySql2Subscriber extends MySqlSubscriber {
  constructor({ packageName = 'mysql2', ...rest }) {
    super({ packageName, ...rest })
  }
}

module.exports = { MySqlSubscriber, MySql2Subscriber }
