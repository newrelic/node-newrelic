/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')
const DatastoreShim = require('../../../lib/shim/datastore-shim.js')
// const symbols = require('../../../lib/symbols')
// const { getConnection, queryParser } = require('../../../lib/instrumentation/elasticsearch')
let agent = null
let shim = null
let initialize = null
const originalShimRequire = DatastoreShim.prototype.require

tap.test('elasticsearch', function (t) {
  t.autoend()

  t.beforeEach(function () {
    agent = helper.loadMockedAgent()
    initialize = require('../../../lib/instrumentation/elasticsearch')
    shim = new DatastoreShim(agent, 'elasticsearch')
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)

    initialize = null
    shim = null
    DatastoreShim.prototype.require = originalShimRequire
  })

  t.test('should initialize', function (t) {
    t.doesNotThrow(
      initialize(
        agent,
        DatastoreShim.DATASTORE_NAMES.ELASTICSEARCH,
        '@elastic/elasticsearch',
        shim
      ),
      'should initialize and not throw'
    )
  })
})
