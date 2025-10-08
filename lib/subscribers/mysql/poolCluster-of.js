/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const PropagationSubscriber = require('../propagation')

class MySQLPoolClusterOfSubscriber extends PropagationSubscriber {
  constructor({ agent, logger, packageName = 'mysql', channelName = 'nr_poolClusterOf' }) {
    super({ agent, logger, packageName, channelName, callback: -1 })
  }
}

module.exports = MySQLPoolClusterOfSubscriber
