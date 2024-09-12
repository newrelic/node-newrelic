/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const fetchEcsInfo = require('../../../lib/utilization/ecs-info')

test('returns null if utilization is disabled', (t, end) => {
  const agent = {
    config: {
      utilization: false
    }
  }
  fetchEcsInfo(agent, (error, data) => {
    assert.equal(error, null)
    assert.equal(data, null)
    end()
  })
})

test('returns null if detect_aws is disabled', (t, end) => {
  const agent = {
    config: {
      utilization: {
        detect_aws: false
      }
    }
  }
  fetchEcsInfo(agent, (error, data) => {
    assert.equal(error, null)
    assert.equal(data, null)
    end()
  })
})

test('returns null if error encountered', (t, end) => {
  const agent = helper.loadMockedAgent({
    utilization: {
      detect_aws: true
    }
  })
  t.after(() => helper.unloadAgent(agent))

  fetchEcsInfo(
    agent,
    (error, data) => {
      assert.equal(error.message, 'boom')
      assert.equal(data, null)
      end()
    },
    { getEcsContainerId }
  )

  function getEcsContainerId({ callback }) {
    callback(Error('boom'))
  }
})

test('returns container id', (t, end) => {
  const agent = helper.loadMockedAgent({
    utilization: {
      detect_aws: true
    }
  })
  t.after(() => helper.unloadAgent(agent))

  fetchEcsInfo(
    agent,
    (error, data) => {
      assert.equal(error, null)
      assert.deepStrictEqual(data, { ecsDockerId: 'ecs-container-1' })
      end()
    },
    { getEcsContainerId }
  )

  function getEcsContainerId({ callback }) {
    callback(null, 'ecs-container-1')
  }
})
