/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MiddlewareSubscriber = require('../middleware')
const resolvePackageVersion = require('../resolve-package-version')

/**
 * Special error handler to ignore if the error passed to next handler
 * is 'route' or 'router', which are used by Express internally to
 * skip out of a route or router.
 *
 * @param {*} err - The error passed to the next handler
 * @returns {boolean} - returns true if error exists and not equal to a string or `route` or `router`
 */
function errorHandler(err) {
  return err && err !== 'route' && err !== 'router'
}

class ExpressSubscriber extends MiddlewareSubscriber {
  #resolvedMeta

  constructor({ agent, logger, packageName = 'express', channelName }) {
    super({ agent, logger, packageName, channelName, system: 'Expressjs', errorHandler })
  }

  get targetModuleMeta() {
    if (this.#resolvedMeta !== undefined) {
      return this.#resolvedMeta
    }

    const version = resolvePackageVersion('express')
    this.#resolvedMeta = {
      name: 'express',
      version
    }
    return this.#resolvedMeta
  }
}

module.exports = ExpressSubscriber
