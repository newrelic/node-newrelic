/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../../lib/agent_helper')
const inspectorInstrumentation = require('../../../../lib/instrumentation/core/inspector')

test('Inspector instrumentation', async (t) => {
  const agent = helper.loadTestAgent(t)
  assert.doesNotThrow(inspectorInstrumentation.bind(null, agent, null))
})
