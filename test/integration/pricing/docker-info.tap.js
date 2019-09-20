'use strict'

var test = require('tap').test
var fs = require('fs')
var common = require('../../../lib/utilization/common')
var dockerInfo = require('../../../lib/utilization/docker-info')
var helper = require('../../lib/agent_helper')
var path = require('path')

var TEST_DIRECTORY =
  path.resolve(__dirname, '../../lib/cross_agent_tests/docker_container_id/')


test('pricing docker info', function(t) {
  var os = require('os')
  var originalPlatform = os.platform
  os.platform = function() { return 'linux' }
  t.tearDown(function() {
    os.platform = originalPlatform
  })

  fs.readFile(TEST_DIRECTORY + '/cases.json', function readCasefile(err, data) {
    if (!t.error(err, 'should not error loading tests')) {
      t.fail('Could not load tests!')
      t.end()
      return
    }

    var cases = JSON.parse(data)

    t.autoend()
    t.ok(cases.length > 0, 'should have tests to run')
    for (var i = 0; i < cases.length; ++i) {
      t.test(cases[i].filename, makeTest(cases[i]))
    }
  })
})

function makeTest(testCase) {
  return function(t) {
    var agent = helper.loadMockedAgent()
    t.tearDown(function() {
      helper.unloadAgent(agent)
      dockerInfo.clearVendorCache()
    })

    mockProcRead(t, path.join(TEST_DIRECTORY, testCase.filename))
    dockerInfo.getVendorInfo(agent, function(err, info) {
      if (testCase.containerId) {
        t.error(err, 'should not have failed')
        t.same(info, {id: testCase.containerId}, 'should have expected container id')
      } else {
        t.notOk(info, 'should not have found container id')
      }

      if (testCase.expectedMetrics) {
        // TODO: No tests currently expect metrics, when one does we'll have to
        // update this test depending on the format of that.
        t.bailout('Docker expected metrics found but can not be handled.')
      } else {
        t.equal(agent.metrics._metrics.toJSON().length, 0, 'should have no metrics')
      }

      t.end()
    })
  }
}

function mockProcRead(t, testFile) {
  var original = common.readProc
  t.tearDown(function() {
    common.readProc = original
  })

  common.readProc = function(file, cb) {
    fs.readFile(testFile, {encoding: 'utf8'}, function(err, data) {
      t.error(err, 'should not fail to load test file')
      cb(err, data)
    })
  }
}
