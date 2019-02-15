'use strict'

const common = require('./common')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const TOPIC_NAME = `test-topic-${Math.floor(Math.random() * 100000)}`

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

  t.test('publish', (t) => {
    helper.runInTransaction((tx) => {
      const params = {TopicArn, Message: 'Hello!'}

      sns.publish(params, (err) => {
        if (err) {
          t.error(err)
        }
        tx.end()
        setImmediate(finish, tx)
      })
    })

    function finish(tx) {
      const messages = common.checkAWSAttributes(t, tx.trace.root, /^MessageBroker/)
      t.equal(messages.length, 1, 'should have 1 message broker segment')

      const attrs = messages[0].attributes.get(common.SEGMENT_DESTINATION)
      t.matches(attrs, {
        'aws.operation': 'publish',
        'aws.requestId': String,
        'aws.service': 'Amazon SNS',
        'aws.region': 'us-east-1'
      }, 'should have expected attributes for publish')

      t.end()
    }
  })
})
