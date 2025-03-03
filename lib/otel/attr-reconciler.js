/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const urltils = require('../util/urltils')
const constants = require('./constants')

const hostKeys = [
  constants.ATTR_NET_HOST_NAME,
  constants.ATTR_NET_PEER_NAME,
  constants.ATTR_SERVER_ADDRESS
]

class AttributeReconciler {
  #agent

  constructor({ agent }) {
    this.#agent = agent
  }

  #resolveHost(hostname) {
    if (urltils.isLocalhost(hostname)) {
      return this.#agent.config.getHostnameSafe(hostname)
    }
    return hostname
  }

  #isHostnameKey(key) {
    return hostKeys.includes(key)
  }

  reconcile({ segment, otelSpan, mapper = {} }) {
    for (const [key, srcValue] of Object.entries(otelSpan.attributes)) {
      let value = srcValue

      if (this.#isHostnameKey(key) === true) {
        value = this.#resolveHost(srcValue)
      }

      if (Object.prototype.hasOwnProperty.call(mapper, key) === true) {
        mapper[key](value)
      } else {
        segment.addAttribute(key, value)
      }
    }
  }
}

module.exports = AttributeReconciler
