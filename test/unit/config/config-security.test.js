/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const Config = require('../../../lib/config')

test('should enable high security mode (HSM) with non-bool truthy HSM setting', () => {
  const applyHSM = Config.prototype._applyHighSecurity

  let hsmApplied = false
  Config.prototype._applyHighSecurity = () => {
    hsmApplied = true
  }
  const config = Config.initialize({
    high_security: 'true'
  })

  assert.equal(!!config.high_security, true)
  assert.equal(hsmApplied, true)

  Config.prototype._applyHighSecurity = applyHSM
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
