/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const semver = require('semver')

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
  if (config.feature_flag.legacy_context_manager) {
    return createLegacyContextManager(config)
  }

  // TODO: Remove >=16 check when we drop Node 14. AsyncLocal became stable in 16.4.0
  if (semver.satisfies(process.version, '<16.4.0')) {
    logger.warn('The AsyncLocalContextManager is only supported on Node version 16.4.0 and later.')
    return createLegacyContextManager(config)
  }

  return createAsyncLocalContextManager(config)
}

function createAsyncLocalContextManager(config) {
  logger.info('Using AsyncLocalContextManager')

  const AsyncLocalContextManager = require('./async-local-context-manager')
  return new AsyncLocalContextManager(config)
}

function createLegacyContextManager(config) {
  logger.info('Using LegacyContextManager')

  const LegacyContextManager = require('./legacy-context-manager')
  return new LegacyContextManager(config)
}

module.exports = createContextManager
