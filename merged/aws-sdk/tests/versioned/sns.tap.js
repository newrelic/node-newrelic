'use strict'

const common = require('./common')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const TOPIC_NAME = `delete-aws-sdk-test-topic-${Math.floor(Math.random() * 100000)}`

tap.test('SNS', (t) => {
  t.autoend()

  let helper = null
  let AWS = null
  let sns = null
  let TopicArn = null

  t.beforeEach((done) => {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'aws-sdk',
      type: 'conglomerate',
      onRequire: require('../../lib/instrumentation')
    })
    AWS = require('aws-sdk')
    sns = new AWS.SNS({region: 'us-east-1'})
    sns.createTopic({Name: TOPIC_NAME}, (err, data) => {
      TopicArn = data.TopicArn
      done()
    })
  })

  t.afterEach((done) => {
    helper && helper.unload()
    sns.deleteTopic({TopicArn}, () => done())
  })

  t.test('publish with callback', (t) => {
    helper.runInTransaction((tx) => {
      const params = {TopicArn, Message: 'Hello!'}

      sns.publish(params, (err) => {
        if (err) {
          t.error(err)
        }
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
        t.error()
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

