/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const subscriberConfigs = require('#agentlib/subscriber-configs.js')

test('channelName should be consistent across cjs/esm variants of the same instrumented function', () => {
  for (const [pkgName, entries] of Object.entries(subscriberConfigs)) {
    for (const entry of entries) {
      const groups = new Map()
      for (const instrumentation of entry.instrumentations) {
        const key = JSON.stringify(instrumentation.functionQuery)
        const channelNames = groups.get(key) ?? groups.set(key, new Set()).get(key)
        channelNames.add(instrumentation.channelName)
      }

      for (const [functionQuery, channelNames] of groups) {
        assert.equal(
          channelNames.size,
          1,
          `${pkgName} "${entry.path}" has mismatched channelNames (${[...channelNames]}) ` +
            `for functionQuery ${functionQuery}. The cjs and esm instrumentations of the ` +
            'same function must subscribe to the same channel.'
        )
      }
    }
  }
})
