/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { getMapping, dbMapper } = require('#agentlib/otel/attr-mapping/db.js')
const AttributeReconciler = require('#agentlib/otel/attr-reconciler.js')
const helper = require('#testlib/agent_helper.js')
const sinon = require('sinon')
const test = require('node:test')
const assert = require('node:assert')
const {
  ATTR_NETWORK_PEER_PORT,
  ATTR_NET_PEER_NAME,
  ATTR_SERVER_ADDRESS,
  ATTR_DB_NAME,
  ATTR_DB_STATEMENT,
  ATTR_DB_SYSTEM,
  ATTR_NET_PEER_PORT
} = require('#agentlib/otel/constants.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    agent: helper.loadMockedAgent()
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('port', () => {
  const span = {
    attributes: {
      [ATTR_NET_PEER_PORT]: 3618
    }
  }
  const { value } = getMapping({ key: 'port', span })
  assert.deepEqual(value, 3618)
})

test('server', () => {
  const span = {
    attributes: {
      [ATTR_NET_PEER_NAME]: 'db-host'
    }
  }
  const { value } = getMapping({ key: 'server', span })
  assert.deepEqual(value, 'db-host')
})

test('dbMapper', (t) => {
  const { agent } = t.nr
  const span = {
    attributes: {
      [ATTR_NETWORK_PEER_PORT]: 3618,
      [ATTR_SERVER_ADDRESS]: 'example.com',
      [ATTR_DB_NAME]: 'db',
      [ATTR_DB_SYSTEM]: 'postgres',
      [ATTR_DB_STATEMENT]: 'select * from table where column = ?;'
    }
  }

  const segment = {
    addAttribute: sinon.stub()
  }
  const mapper = dbMapper({ segment })
  const reconciler = new AttributeReconciler({ agent })
  reconciler.reconcile({ segment, otelSpan: span, mapper })
  assert.equal(segment.addAttribute.callCount, 4)
  const [port, host, dbName, product] = segment.addAttribute.args
  assert.deepEqual(port, ['port_path_or_id', 3618])
  assert.deepEqual(host, ['host', 'example.com'])
  assert.deepEqual(dbName, ['database_name', 'db'])
  assert.deepEqual(product, ['product', 'postgres'])
})
