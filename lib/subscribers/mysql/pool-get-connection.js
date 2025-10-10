/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const PropagationSubscriber = require('../propagation')

/**
 * This subscriber is only required to propagate the context within
 * `Pool#getConnection`.
 */
class MySQLPoolGetConnectionSubscriber extends PropagationSubscriber {
  constructor({ agent, logger, packageName = 'mysql', channelName = 'nr_poolGetConnection' }) {
    super({ agent, logger, packageName, channelName, callback: -1 })
  }
}

module.exports = MySQLPoolGetConnectionSubscriber
