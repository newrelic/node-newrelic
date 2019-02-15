'use strict'

const common = require('./common')
const tap = require('tap')
const utils = require('@newrelic/test-utilities')

const AWS_REGION = 'us-east-1'

tap.test('SQS API', (t) => {
  t.autoend()

  let helper = null
  let AWS = null
  let sqs = null

  t.beforeEach((done) => {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'aws-sdk',
      type: 'conglomerate',
      onRequire: require('../../lib/instrumentation')
    })
    AWS = require('aws-sdk')
    sqs = new AWS.SQS({apiVersion: '2012-11-05', region: AWS_REGION})
    done()
  })

  t.afterEach((done) => {
    helper && helper.unload()
    done()
  })

  t.test('commands', (t) => {
    const queueName = 'aws-sdk-test-queue-' + Math.floor(Math.random() * 100000)
    let queueUrl = null
    let sendMessageRequestId = null
    let sendMessageBatchRequestId = null
    let receiveMessageRequestId = null

    const createParams = getCreateParams(queueName)
    sqs.createQueue(createParams, function(createErr, createData) {
      t.error(createErr)

      queueUrl = createData.QueueUrl

      helper.runInTransaction((transaction) => {
        const sendMessageParams = getSendMessageParams(queueUrl)
        sqs.sendMessage(sendMessageParams, (sendErr, sendData) => {
          t.error(sendErr)
          t.ok(sendData.MessageId)

          sendMessageRequestId = getRequestId(t, sendData)

          const sendMessageBatchParams = getSendMessageBatchParams(queueUrl)
          sqs.sendMessageBatch(sendMessageBatchParams, (sendBatchErr, sendBatchData) => {
            t.error(sendBatchErr)
            t.ok(sendBatchData.Successful)

            sendMessageBatchRequestId = getRequestId(t, sendBatchData)

            const receiveMessageParams = getReceiveMessageParams(queueUrl)
            sqs.receiveMessage(receiveMessageParams, (receiveErr, receiveData) => {
              t.error(receiveErr)
              t.ok(receiveData.Messages)

              receiveMessageRequestId = getRequestId(t, receiveData)

              transaction.end()
              setImmediate(finish, transaction)
            })
          })
        })
      })
    })

    t.tearDown(() => {
      // Cleanup queue after test
      const deleteParams = {
        QueueUrl: queueUrl
      }

      sqs.deleteQueue(deleteParams, function(err) {
          if (err) {
            throw err
          }
      })
    })

    function finish(transaction) {
      const expectedSegmentCount = 3

      const root = transaction.trace.root
      const segments = common.checkAWSAttributes(t, root, common.SQS_PATTERN)

      t.equal(
        segments.length,
        expectedSegmentCount,
        `should have ${expectedSegmentCount} AWS MessageBroker/SQS segments`
      )

      const [sendMessage, sendMessageBatch, receiveMessage] = segments

      checkName(t, sendMessage.name, 'Produce', queueName)
      checkAttributes(t, sendMessage, 'sendMessage', sendMessageRequestId)

      checkName(t, sendMessageBatch.name, 'Produce', queueName)
      checkAttributes(t, sendMessageBatch, 'sendMessageBatch', sendMessageBatchRequestId)

      checkName(t, receiveMessage.name, 'Consume', queueName)
      checkAttributes(t, receiveMessage, 'receiveMessage', receiveMessageRequestId)

      t.end()
    }
  })
})

function checkName(t, name, action, queueName) {
  const specificName = `/${action}/Named/${queueName}`

  t.matches(name, specificName, 'should have correct name')
}

function checkAttributes(t, segment, operation, expectedRequestId) {
  const actualAttributes = segment.attributes.get(common.SEGMENT_DESTINATION)

  const expectedAttributes = {
    'aws.operation': operation,
    'aws.requestId': expectedRequestId,
    'aws.service': 'Amazon SQS',
    'aws.region': AWS_REGION
  }

  t.matches(
    actualAttributes,
    expectedAttributes,
    `should have expected attributes for ${operation}`
  )
}

function getRequestId(t, apiReturnedData) {
  t.ok(apiReturnedData.ResponseMetadata)

  return apiReturnedData.ResponseMetadata.RequestId
}

function getCreateParams(queueName) {
  const params = {
    QueueName: queueName,
    Attributes: {
      MessageRetentionPeriod: '1200' // 20 minutes
    }
  }

  return params
}

function getSendMessageParams(queueUrl) {
  const params = {
    MessageAttributes: {
      Attr1: {
        DataType: 'String',
          StringValue: 'One'
        }
    },
    MessageBody: 'This is a test message',
    QueueUrl: queueUrl
  }

  return params
}

function getSendMessageBatchParams(queueUrl) {
  const params = {
    Entries: [
      {
          Id: 'ONE',
          MessageBody: 'ONE BODY',
          MessageAttributes: {
              Attribute1: {DataType: 'String', StringValue: 'Value 1'},
              Attribute2: {DataType: 'String', StringValue: 'Value 2'}
          }
      },
      {
          Id: 'TWO',
          MessageBody: 'TWO BODY',
          MessageAttributes: {
              Attribute1: {DataType: 'String', StringValue: 'Value 1'},
              Attribute2: {DataType: 'String', StringValue: 'Value 2'}
          }
      }
    ],
    QueueUrl: queueUrl
  }

  return params
}

function getReceiveMessageParams(queueUrl) {
  const params = {
    AttributeNames: [
       'SentTimestamp'
    ],
    MaxNumberOfMessages: 2,
    MessageAttributeNames: [
       'All'
    ],
    QueueUrl: queueUrl
  }

  return params
}
