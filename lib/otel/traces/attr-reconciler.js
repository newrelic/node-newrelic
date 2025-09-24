/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const urltils = require('#agentlib/util/urltils.js')
const constants = require('./constants.js')

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

  resolveHost(hostname) {
    if (urltils.isLocalhost(hostname)) {
      return this.#agent.config.getHostnameSafe()
    }
    return hostname
  }

  isHostnameKey(key) {
    return hostKeys.includes(key)
  }

  reconcile({ segment, otelSpan, excludeAttributes = new Set() }) {
    for (const [key, srcValue] of Object.entries(otelSpan.attributes)) {
      let value = srcValue

      if (this.isHostnameKey(key) === true) {
        value = this.resolveHost(srcValue)
      }

      if (!excludeAttributes.has(key)) {
        segment.addAttribute(key, value)
      }
    }
  }
}

module.exports = AttributeReconciler
