/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = class TraceStacks {
  constructor(config) {
    this.stack = config?.logging.diagnostics ? [] : null
  }

  probe(action, data) {
    if (this.stack) {
      this.stack.push({
        stack: new Error(action).stack.split('\n'),
        extra: data
      })
    }
  }

  serialize(name) {
    return { segment: name, stacks: this.stack }
  }
}
