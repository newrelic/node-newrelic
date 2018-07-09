'use strict'

const semver = require('semver')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')

utils(tap)

const EXTERNAL_NAME = semver.lt(process.version, '9.0.0')
  ? 'External/newrelic.com:443/'
  : 'External/newrelic.com/'

tap.test('SuperAgent instrumentation', (t) => {
  t.autoend()

  let helper = null
  let request = null
  t.beforeEach((done) => {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'superagent',
      type: 'generic',
      onRequire: require('../../lib/instrumentation'),
      onError: done
    })
    request = require('superagent')
    done()
  })
  t.afterEach((done) => {
    helper.unload()
    done()
  })

  t.test('should maintain transaction context with callbacks', (t) => {
    helper.runInTransaction((tx) => {
      request.get('https://newrelic.com', function testCallback() {
        t.transaction(tx)
        t.segments(tx.trace.root, [{
          name: EXTERNAL_NAME,
          children: [{name: 'Callback: testCallback'}]
        }])
        t.end()
      })
    })
  })

  t.test('should maintain transaction context with promises', (t) => {
    helper.runInTransaction((tx) => {
      request.get('https://newrelic.com').then(function testThen() {
        t.transaction(tx)
        t.segments(tx.trace.root, [{
          name: EXTERNAL_NAME,
          children: [{name: 'Callback: <anonymous>'}] // CB created by superagent
        }])
        t.end()
      })
    })
  })
})
