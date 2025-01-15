/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const urltils = require('../../lib/util/urltils')

exports.findSegment = findSegment
exports.getMetricHostName = getMetricHostName

function findSegment(trace, root, name) {
  const children = trace.getChildren(root.id)
  if (root.name === name) {
    return root
  } else if (children.length) {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      const found = findSegment(trace, child, name)
      if (found) {
        return found
      }
    }
  }
}

function getMetricHostName(agent, host) {
  return urltils.isLocalhost(host) ? agent.config.getHostnameSafe() : host
}
