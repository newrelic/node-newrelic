/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQLEmitterPropagator = require('../mysql/emitter-propagator')

/**
 * Provides a base `PropagationSubscriber` for MySQL2 functions that
 * need their context propagated.
 *
 * Defaults to listening to `mysql2` `nr_connectionAddCommand` channel.
 */
class MySQL2EmitterPropagator extends MySQLEmitterPropagator {
  constructor({ agent, logger, channelName = 'nr_connectionAddCommand', packageName = 'mysql2' }) {
    super({ agent, logger, channelName, packageName, callback: null })
  }
}

module.exports = MySQL2EmitterPropagator
