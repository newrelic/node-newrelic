/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const PropagationSubscriber = require('../propagation')

class AcceptMessageSubscriber extends PropagationSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'amqplib', channelName: 'nr_acceptMessage', callback: 0 })
  }
}

module.exports = AcceptMessageSubscriber
