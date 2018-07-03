'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

tap.test('SuperAgent instrumentation', (t) => {
  const helper = utils.TestAgent.makeInstrumented()
  t.tearDown(() => helper.unload())

  helper.registerInstrumentation({
    moduleName: 'superagent',
    type: 'generic',
    onRequire: '../../lib/instrumentation'
  })
  const superagent = require('superagent')

  t.ok(superagent.Request, 'should not remove Request class')
  t.type(superagent.Request.prototype.then, 'function')
  t.type(superagent.Request.prototype.end, 'function')

  t.end()
})
