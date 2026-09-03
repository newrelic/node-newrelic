/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const { kafkaCtx } = require('#agentlib/symbols.js')
const ConstructorSubscriber = require('#agentlib/subscribers/kafkajs/client-constructor.js')
const ClusterConstructorSubscriber = require('#agentlib/subscribers/kafkajs/cluster-constructor.js')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const logger = require('../../../mocks/logger')()
  const subscriber = new ConstructorSubscriber({ agent, logger })
  ctx.nr = { agent, subscriber }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ClusterConstructorSubscriber.pendingCluster.current = null
})

test('should not track a cluster id when ClusterConstructorSubscriber did not capture a Cluster', (t) => {
  const { agent, subscriber } = t.nr
  agent.config.kafka.metrics.cluster.metrics.enabled = true
  // Simulates the defensive scenario where the `Cluster` constructor hook
  // never fired.
  ClusterConstructorSubscriber.pendingCluster.current = null

  const client = { producer: () => { return {} } }
  subscriber.end({ arguments: [{ brokers: ['broker1'] }], self: client }, {})
  const producer = client.producer()

  assert.equal(producer[kafkaCtx].clusterId, undefined)
})
