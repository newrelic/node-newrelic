/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger')

/**
 * Factory function to create context manager implementations used by the
 * ContextManager class.
 *
 * @param {object} config New Relic config instance.
 * @returns {*} The appropriate underlying context manager implementation based on
 * the current configuration.
 */
function createContextManager(config) {
  return createAsyncLocalContextManager(config)
}

function createAsyncLocalContextManager(config) {
  logger.info('Using AsyncLocalContextManager')

  const AsyncLocalContextManager = require('./async-local-context-manager')
  return new AsyncLocalContextManager(config)
}

module.exports = createContextManager
