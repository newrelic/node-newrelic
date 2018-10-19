'use strict'

const API = require('../../../api')
const chai = require('chai')
const expect = chai.expect
const helper = require('../../lib/agent_helper')
const lambdaSampleEvents = require('./lambdaSampleEvents')

const ATTR_DEST = require('../../../lib/config/attribute-filter').DESTINATIONS

describe('The recordLambda API', () => {
  const bgGroup = 'Function'
  const functionName = 'testName'
  const expectedBgTransactionName = 'OtherTransaction/' + bgGroup + '/' + functionName
  const errorMessage = 'sad day'

  let agent
  let api

  let stubEvent
  let stubContext
  let stubCallback

  let error

  beforeEach(() => {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    stubEvent = {}
    stubContext = {
      done: () => {},
      succeed: () => {},
      fail: () => {},
      functionName: functionName,
      functionVersion: 'TestVersion',
      invokedFunctionArn: 'arn:test:function',
      memoryLimitInMB: '128',
      awsRequestId: 'testid'
    },
    stubCallback = () => {}

    process.env.AWS_REGION = 'nr-test'
    process.env.AWS_EXECUTION_ENV = 'Test_nodejsNegative2.3'

    error = new SyntaxError(errorMessage)
  })

  afterEach(() => {
    stubEvent = null
    stubContext = null
    stubCallback = null
    error = null

    delete process.env.AWS_REGION
    delete process.env.AWS_EXECUTION_ENV

    helper.unloadAgent(agent)
    agent = null
    api = null
  })

  it('should return original handler if not a function', () => {
    const handler = {}
    const newHandler = api.recordLambda(handler)

    expect(newHandler).to.equal(handler)
  })

  it('should report API supportability metric', () => {
    api.recordLambda(() => {})

    const metric = agent.metrics.getMetric('Supportability/API/recordLambda')
    expect(metric.callCount).to.equal(1)
  })

  it('should create a transaction for handler', () => {
    const wrappedHandler = api.recordLambda((event, context, callback) => {
      const transaction = agent.tracer.getTransaction()
      expect(transaction.type).to.equal('bg')
      expect(transaction.getFullName()).to.equal(expectedBgTransactionName)
      expect(transaction.isActive()).to.be.true

      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
  })

  it('should create a segment for handler', () => {
    const wrappedHandler = api.recordLambda((event, context, callback) => {
      const segment = api.shim.getSegment()
      expect(segment).is.not.null
      expect(segment.name).to.equal(functionName)

      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
  })

  it('should capture cold start boolean on first invocation', (done) => {
    agent.on('transactionFinished', confirmColdStart)

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmColdStart(transaction) {
      const attributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
      expect(attributes['aws.lambda.coldStart']).to.equal(true)
      done()
    }
  })

  it('should not include cold start on subsequent invocations', (done) => {
    let transactionNum = 1

    agent.on('transactionFinished', confirmNoAdditionalColdStart)

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
    wrappedHandler(stubEvent, stubContext, () => {
      done()
    })

    function confirmNoAdditionalColdStart(transaction) {
      if (transactionNum > 1) {
        const attributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)
        expect(attributes['aws.lambda.coldStart']).to.not.exist
      }

      transactionNum++
    }
  })

  it('should capture AWS agent attributes', (done) => {
    agent.on('transactionFinished', confirmAgentAttributes)

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttributes(transaction) {
      const attributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(attributes['aws.lambda.functionName']).to.equal(stubContext.functionName)
      expect(attributes['aws.lambda.functionVersion'])
        .to.equal(stubContext.functionVersion)
      expect(attributes['aws.lambda.arn']).to.equal(stubContext.invokedFunctionArn)
      expect(attributes['aws.lambda.memoryLimit']).to.equal(stubContext.memoryLimitInMB)
      expect(attributes['aws.requestId']).to.equal(stubContext.awsRequestId)
      expect(attributes['aws.region']).to.equal(process.env.AWS_REGION)
      expect(attributes['aws.executionEnv']).to.equal(process.env.AWS_EXECUTION_ENV)

      done()
    }
  })

  it('should not add attributes from empty event', (done) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.lambda.eventSource.arn']).to.be.undefined
      done()
    }
  })

  it('should capture kinesis data stream event source arn', (done) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.kinesisDataStreamEvent

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.lambda.eventSource.arn'])
        .to.equal('kinesis:eventsourcearn')
      done()
    }
  })

  it('should capture S3 PUT event source arn attribute', (done) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.s3PutEvent

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.lambda.eventSource.arn']).to.equal('bucketarn')
      done()
    }
  })

  it('should capture SNS event source arn attribute', (done) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.snsEvent

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.lambda.eventSource.arn'])
        .to.equal('eventsubscriptionarn')
      done()
    }
  })

  it('should capture DynamoDB Update event source attribute', (done) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.dynamoDbUpdateEvent

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.lambda.eventSource.arn'])
        .to.equal('dynamodb:eventsourcearn')
      done()
    }
  })

  it('should capture CodeCommit event source attribute', (done) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.codeCommitEvent

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.lambda.eventSource.arn'])
        .to.equal('arn:aws:codecommit:us-west-2:123456789012:my-repo')
      done()
    }
  })

  it('should not capture unknown event source attribute', (done) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.cloudFrontEvent

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.lambda.eventSource.arn']).to.be.undefined
      done()
    }
  })

  it('should capture Kinesis Data Firehose event source attribute', (done) => {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.kinesisDataFirehoseEvent

    const wrappedHandler = api.recordLambda((event, context, callback) => {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.lambda.eventSource.arn']).to.equal('aws:lambda:events')
      done()
    }
  })

  describe('when callback used', () => {
    it('should end appropriately', () => {
      let transaction

      const wrappedHandler = api.recordLambda((event, context, callback) => {
        transaction = agent.tracer.getTransaction()
        callback(null, 'worked')
      })

      wrappedHandler(stubEvent, stubContext, function confirmEndCallback() {
        expect(transaction.isActive()).to.be.false

        const currentTransaction = agent.tracer.getTransaction()
        expect(currentTransaction).is.null
      })
    })

    it('should notice errors', (done) => {
      agent.on('transactionFinished', confirmErrorCapture)

      const wrappedHandler = api.recordLambda((event, context, callback) => {
        callback(error, 'failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        expect(agent.errors.errors.length).to.equal(1)
        const noticedError = agent.errors.errors[0]
        expect(noticedError[1], 'transaction name').to.equal(expectedBgTransactionName)
        expect(noticedError[2], 'message').to.equal(errorMessage)
        expect(noticedError[3], 'type').to.equal('SyntaxError')

        done()
      }
    })

    it('should notice string errors', (done) => {
      agent.on('transactionFinished', confirmErrorCapture)

      const wrappedHandler = api.recordLambda((event, context, callback) => {
        callback('failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        expect(agent.errors.errors.length).to.equal(1)
        const noticedError = agent.errors.errors[0]
        expect(noticedError[1], 'transaction name').to.equal(expectedBgTransactionName)
        expect(noticedError[2], 'message').to.equal('failed')
        expect(noticedError[3], 'type').to.equal('Error')

        const data = noticedError[4]
        expect(data.stack_trace, 'stack_trace').to.exist

        done()
      }
    })
  })

  describe('when context.done used', () => {
    it('should end appropriately', () => {
      let transaction

      context.done = confirmEndCallback

      const wrappedHandler = api.recordLambda((event, context) => {
        transaction = agent.tracer.getTransaction()
        context.done(null, 'worked')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmEndCallback() {
        expect(transaction.isActive()).to.be.false

        const currentTransaction = agent.tracer.getTransaction()
        expect(currentTransaction).is.null
      }
    })

    it('should notice errors', (done) => {
      agent.on('transactionFinished', confirmErrorCapture)

      const wrappedHandler = api.recordLambda((event, context) => {
        context.done(error, 'failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        expect(agent.errors.errors.length).to.equal(1)
        const noticedError = agent.errors.errors[0]
        expect(noticedError[1], 'transaction name').to.equal(expectedBgTransactionName)
        expect(noticedError[2], 'message').to.equal(errorMessage)
        expect(noticedError[3], 'type').to.equal('SyntaxError')

        done()
      }
    })

    it('should notice string errors', (done) => {
      agent.on('transactionFinished', confirmErrorCapture)

      const wrappedHandler = api.recordLambda((event, context) => {
        context.done('failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        expect(agent.errors.errors.length).to.equal(1)
        const noticedError = agent.errors.errors[0]
        expect(noticedError[1], 'transaction name').to.equal(expectedBgTransactionName)
        expect(noticedError[2], 'message').to.equal('failed')
        expect(noticedError[3], 'type').to.equal('Error')

        const data = noticedError[4]
        expect(data.stack_trace, 'stack_trace').to.exist

        done()
      }
    })
  })

  describe('when context.succeed used', () => {
    it('should end appropriately', () => {
      let transaction

      context.succeed = confirmEndCallback

      const wrappedHandler = api.recordLambda((event, context) => {
        transaction = agent.tracer.getTransaction()
        context.succeed('worked')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmEndCallback() {
        expect(transaction.isActive()).to.be.false

        const currentTransaction = agent.tracer.getTransaction()
        expect(currentTransaction).is.null
      }
    })
  })

  describe('when context.fail used', () => {
    it('should end appropriately', () => {
      let transaction

      context.fail = confirmEndCallback

      const wrappedHandler = api.recordLambda((event, context) => {
        transaction = agent.tracer.getTransaction()
        context.fail()
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmEndCallback() {
        expect(transaction.isActive()).to.be.false

        const currentTransaction = agent.tracer.getTransaction()
        expect(currentTransaction).is.null
      }
    })

    it('should notice errors', (done) => {
      agent.on('transactionFinished', confirmErrorCapture)

      const wrappedHandler = api.recordLambda((event, context) => {
        context.fail(error)
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        expect(agent.errors.errors.length).to.equal(1)
        const noticedError = agent.errors.errors[0]
        expect(noticedError[1], 'transaction name').to.equal(expectedBgTransactionName)
        expect(noticedError[2], 'message').to.equal(errorMessage)
        expect(noticedError[3], 'type').to.equal('SyntaxError')

        done()
      }
    })

    it('should notice string errors', (done) => {
      agent.on('transactionFinished', confirmErrorCapture)

      const wrappedHandler = api.recordLambda((event, context) => {
        context.fail('failed')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmErrorCapture() {
        expect(agent.errors.errors.length).to.equal(1)
        const noticedError = agent.errors.errors[0]
        expect(noticedError[1], 'transaction name').to.equal(expectedBgTransactionName)
        expect(noticedError[2], 'message').to.equal('failed')
        expect(noticedError[3], 'type').to.equal('Error')

        const data = noticedError[4]
        expect(data.stack_trace, 'stack_trace').to.exist

        done()
      }
    })
  })
})

