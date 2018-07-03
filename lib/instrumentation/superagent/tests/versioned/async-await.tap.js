'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

utils(tap)

tap.test('SuperAgent instrumentation with async/await', (t) => {
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

  t.test('should maintain transaction context with promises', (t) => {
    helper.runInTransaction(async function(tx) {
      await request.get('https://newrelic.com')

      t.transaction(tx)
      t.segments(tx.trace.root, [{
        name: 'External/newrelic.com:443/',
        children: [{name: 'Callback: <anonymous>'}] // CB created by superagent
      }])
      t.end()
    })
  })
})
