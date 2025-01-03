/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const tests = require('../../lib/cross_agent_tests/datastores/datastore_instances')
const DatastoreParameters = require('../../../lib/shim/specs/params/datastore')

test('Datastore instance metrics collected via the datastore shim', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach(function (ctx) {
    const { agent } = ctx.nr
    if (agent) {
      helper.unloadAgent(agent)
    }
  })

  for (const test of tests) {
    await t.test(test.name, function (t, end) {
      const { agent } = t.nr
      agent.config.getHostnameSafe = function () {
        return test.system_hostname
      }

      const shim = new DatastoreShim(agent, 'testModule', null)
      shim.setDatastore(test.product)

      const testInstrumented = {
        query: function () {}
      }
      shim.recordOperation(testInstrumented, 'query', function () {
        let dbHost = test.db_hostname
        if (!dbHost && (test.unix_socket || test.database_path)) {
          dbHost = 'localhost'
        }
        // If any value is provided for a path or port, it must be used.
        // Otherwise use 'default'.
        let port = 'default'
        if (
          Object.prototype.hasOwnProperty.call(test, 'unix_socket') ||
          Object.prototype.hasOwnProperty.call(test, 'database_path') ||
          Object.prototype.hasOwnProperty.call(test, 'port')
        ) {
          port = test.unix_socket || test.database_path || test.port
        }
        return {
          parameters: new DatastoreParameters({
            host: dbHost,
            port_path_or_id: port
          })
        }
      })

      helper.runInTransaction(agent, function (tx) {
        testInstrumented.query()

        tx.end()
        assert.ok(getMetrics(agent).unscoped[test.expected_instance_metric])
        end()
      })
    })
  }
})

function getMetrics(agent) {
  return agent.metrics._metrics
}
