/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const Config = require('../../../lib/config')

test('should enable high security mode (HSM) with a stringy truthy HSM setting', () => {
  const config = Config.initialize({
    high_security: 'true'
  })

  assert.equal(config.high_security, true)

  // Applying high security mode adds this global attribute exclusion rule, so
  // its presence confirms HSM settings were actually applied.
  assert.equal(config.attributes.exclude.includes('request.parameters.*'), true)
})

test('ai_monitoring should not be enabled in HSM', () => {
  const config = Config.initialize({
    ai_monitoring: {
      enabled: true
    },
    high_security: 'true'
  })

  assert.equal(config.ai_monitoring.enabled, false)
})
