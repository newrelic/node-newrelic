'use strict'

const tap = require('tap')

tap.test('loading the app with invalid config', (t) => {
  t.plan(3)

  process.env.AWS_LAMBDA_FUNCTION_NAME = 'lambdaName'
  process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED = true
  process.env.NEW_RELIC_LICENSE_KEY = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b'
  process.env.NEW_RELIC_NO_CONFIG_FILE = true

  let api = null
  t.doesNotThrow(() => {
    api = require('../../../')
  }, 'should not die when the config is invalid')

  t.ok(api, 'should have a stub API')
  t.notOk(api.agent, 'should not have an associated agent')
})
