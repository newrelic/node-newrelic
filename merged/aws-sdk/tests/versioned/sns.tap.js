/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const common = require('./common')
const { createEmptyResponseServer, FAKE_CREDENTIALS } = require('./aws-server-stubs')

tap.test('SNS', (t) => {
  t.autoend()

  let helper = null
  let AWS = null
  let sns = null
  let TopicArn = null

  let server = null

  t.beforeEach((done) => {
    server = createEmptyResponseServer()
    server.listen(0, () => {
      helper = utils.TestAgent.makeInstrumented()
      helper.registerInstrumentation({
        moduleName: 'aws-sdk',
        type: 'conglomerate',
        onRequire: require('../../lib/instrumentation')
      })
      AWS = require('aws-sdk')

      sns = new AWS.SNS({
        credentials: FAKE_CREDENTIALS,
        endpoint: `http://localhost:${server.address().port}`,
        region: 'us-east-1'
      })

      done()
    })
  })

  t.afterEach((done) => {
    server.close()
    server = null

    helper && helper.unload()

    done()
  })

  t.test('publish with callback', (t) => {
    helper.runInTransaction((tx) => {
      const params = {TopicArn, Message: 'Hello!'}

      sns.publish(params, (err) => {
        t.error(err)
        tx.end()

        const args = [t, tx]
        setImmediate(finish, ...args)
      })
    })
  })

  t.test('publish with promise', (t) => {
    helper.runInTransaction(async tx => {
      const params = {TopicArn, Message: 'Hello!'}

      try {
        await sns.publish(params).promise()
      } catch (error) {
        t.error(error)
      }

      tx.end()

      const args = [t, tx]
      setImmediate(finish, ...args)
    })
  })
})

function finish(t, tx) {
  const root = tx.trace.root

  const messages = common.checkAWSAttributes(t, root, common.SNS_PATTERN)
  t.equal(messages.length, 1, 'should have 1 message broker segment')

  const externalSegments = common.checkAWSAttributes(t, root, common.EXTERN_PATTERN)
  t.equal(externalSegments.length, 0, 'should not have any External segments')

  const attrs = messages[0].attributes.get(common.SEGMENT_DESTINATION)
  t.matches(attrs, {
    'aws.operation': 'publish',
    'aws.requestId': String,
    'aws.service': 'Amazon SNS',
    'aws.region': 'us-east-1'
  }, 'should have expected attributes for publish')

  t.end()
}

