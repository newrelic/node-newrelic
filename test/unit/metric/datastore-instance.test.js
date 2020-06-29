/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var expect = require('chai').expect
var helper = require('../../lib/agent_helper')
var DatastoreShim = require('../../../lib/shim/datastore-shim')
var ParsedStatement = require('../../../lib/db/parsed-statement')
var tests = require('../../lib/cross_agent_tests/datastores/datastore_instances')


describe('Datastore instance metrics collected via the datastore shim', function() {
  var agent = null

  beforeEach(function() {
    agent = helper.loadMockedAgent()
  })

  afterEach(function() {
    if (agent) {
      helper.unloadAgent(agent)
    }
    agent = null
  })

  tests.forEach(function(test) {
    it(test.name, function(done) {
      agent.config.getHostnameSafe = function() {
        return test.system_hostname
      }

      var shim = new DatastoreShim(agent, 'testModule', null, test.product)

      var testInstrumented = {
        query: function() {}
      }
      shim.recordOperation(testInstrumented, 'query', function() {
        var dbHost = test.db_hostname
        if (!dbHost && (test.unix_socket || test.database_path)) {
          dbHost = 'localhost'
        }
        // If any value is provided for a path or port, it must be used.
        // Otherwise use 'default'.
        var port = 'default'
        if (
          test.hasOwnProperty('unix_socket') ||
          test.hasOwnProperty('database_path') ||
          test.hasOwnProperty('port')
        ) {
          port = test.unix_socket || test.database_path || test.port
        }
        return {
          parameters: {
            host: dbHost,
            port_path_or_id: port
          }
        }
      })

      helper.runInTransaction(agent, function(tx) {
        testInstrumented.query()

        tx.end()
        expect(getMetrics(agent).unscoped).to.have.property(test.expected_instance_metric)
        done()
      })
    })
  })
})

describe('Datastore instance metrics captured through the segment', function() {
  var agent = null

  beforeEach(function() {
    agent = helper.loadMockedAgent()
  })

  afterEach(function() {
    if (agent) {
      helper.unloadAgent(agent)
    }
    agent = null
  })

  tests.forEach(function(test) {
    it(test.name, function(done) {
      agent.config.getHostnameSafe = function() {
        return test.system_hostname
      }

      helper.runInTransaction(agent, function(tx) {
        var ps = new ParsedStatement(test.product, 'SELECT', 'bar')
        var child = tx.trace.root.add('test segment', ps.recordMetrics.bind(ps))

        // Each instrumentation must make the following checks when pulling
        // instance attributes from their respective drivers.

        // If we don't have a host name specified, but are connecting over the
        // file system using either a domain socket or a path to the db file
        // then the database host is localhost.
        var dbHost = test.db_hostname
        if (!dbHost && (test.unix_socket || test.database_path)) {
          dbHost = 'localhost'
        }

        // If any value is provided for a path or port, it must be used.
        // Otherwise use 'default'.
        var port = 'default'
        if (
          test.hasOwnProperty('unix_socket') ||
          test.hasOwnProperty('database_path') ||
          test.hasOwnProperty('port')
        ) {
          port = test.unix_socket || test.database_path || test.port
        }

        child.captureDBInstanceAttributes(dbHost, port, 'foo')
        child.touch()

        tx.end()
        expect(getMetrics(agent).unscoped).to.have.property(test.expected_instance_metric)
        done()
      })
    })
  })
})

function getMetrics(agent) {
  return agent.metrics._metrics
}
