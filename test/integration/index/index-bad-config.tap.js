'use strict'

const tap = require('tap')

tap.test('loading the app with invalid config [SECRETS]', (t) => {
  t.plan(3)

  process.env.AWS_LAMBDA_FUNCTION_NAME = 'lambdaName'
  process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED = true
  process.env.NEW_RELIC_LICENSE_KEY = process.env.TEST_LICENSE
  process.env.NEW_RELIC_NO_CONFIG_FILE = true

  let api = null
  t.doesNotThrow(() => {
    api = require('../../../')
  }, 'should not die when the config is invalid')

  t.ok(api, 'should have a stub API')
  t.notOk(api.agent, 'should not have an associated agent')
})
