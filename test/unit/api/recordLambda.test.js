'use strict'

var API = require('../../../api')
var chai = require('chai')
var expect = chai.expect
var helper = require('../../lib/agent_helper')
var lambdaSampleEvents = require('./lambdaSampleEvents')

const ATTR_DEST = require('../../../lib/config/attribute-filter').DESTINATIONS

describe('The recordLambda API', function() {
  const bgGroup = 'Function'
  const functionName = 'testName'
  const expectedBgTransactionName = 'OtherTransaction/' + bgGroup + '/' + functionName
  const errorMessage = 'sad day'
  const coldStartTimeName = 'coldStartTime'

  let agent
  let api

  let stubEvent
  let stubContext
  let stubCallback

  let error

  beforeEach(function() {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    stubEvent = {}
    stubContext = {
      functionName: functionName,
      done: function() {},
      succeed: function() {},
      fail: function() {},
      functionName: functionName,
      functionVersion: 'TestVersion',
      invokedFunctionArn: 'arn:test:function',
      memoryLimitInMB: '128',
      awsRequestId: 'testid'
    },
    stubCallback = function() {}

    process.env.AWS_REGION = 'nr-test'
    process.env.AWS_EXECUTION_ENV = 'Test_nodejsNegative2.3'

    error = new SyntaxError(errorMessage)
  })

  afterEach(function() {
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

  it('should return original handler if not a function', function() {
    var handler = {}
    var newHandler = api.recordLambda(handler)

    expect(newHandler).to.equal(handler)
  })

  it('should report API supportability metric', function() {
    api.recordLambda(function() {})

    const metric = agent.metrics.getMetric('Supportability/API/recordLambda')
    expect(metric.callCount).to.equal(1)
  })

  it('should create a transaction for handler', function() {
    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      const transaction = agent.tracer.getTransaction()
      expect(transaction.type).to.equal('bg')
      expect(transaction.getFullName()).to.equal(expectedBgTransactionName)
      expect(transaction.isActive()).to.be.true

      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
  })

  it('should create a segment for handler', function() {
    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      const segment = api.shim.getSegment()
      expect(segment).is.not.null
      expect(segment.name).to.equal(functionName)

      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
  })

  it('should capture cold start on first invocation', function(done) {
    agent.on('transactionFinished', confirmColdStart)

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmColdStart(transaction) {
      const metric = agent.metrics.getMetric(coldStartTimeName)
      expect(metric.callCount).to.equal(1)

      const scopedMetric = agent.metrics.getMetric(
        coldStartTimeName, expectedBgTransactionName
      )
      expect(scopedMetric.callCount).to.equal(1)

      var attributes = agent._addIntrinsicAttrsFromTransaction(transaction)
      expect(attributes.coldStartTime, 'coldStartTime intrinsic').to.exist

      done()
    }
  })

  it('should not create cold start on subsequent invocations', function(done) {
    let transactionNum = 1

    agent.on('transactionFinished', confirmNoAdditionalColdStart)

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)
    wrappedHandler(stubEvent, stubContext, function() {
      done()
    })

    function confirmNoAdditionalColdStart(transaction) {
      const metric = agent.metrics.getMetric(coldStartTimeName)
      expect(metric.callCount).to.equal(1)

      const scopedMetric = agent.metrics.getMetric(
        coldStartTimeName, expectedBgTransactionName
      )
      expect(scopedMetric.callCount).to.equal(1)

      if (transactionNum > 1) {
        var attributes = agent._addIntrinsicAttrsFromTransaction(transaction)
        expect(attributes.coldStartTime, 'coldStartTime intrinsic').to.not.exist
      }

      transactionNum++
    }
  })

  it('should capture AWS agent attributes', function(done) {
    agent.on('transactionFinished', confirmAgentAttributes)

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttributes(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.functionName']).to.equal(stubContext.functionName)
      expect(agentAttributes['aws.functionVersion']).to.equal(stubContext.functionVersion)
      expect(agentAttributes['aws.arn']).to.equal(stubContext.invokedFunctionArn)
      expect(agentAttributes['aws.memoryLimit']).to.equal(stubContext.memoryLimitInMB)
      expect(agentAttributes['aws.requestId']).to.equal(stubContext.awsRequestId)

      expect(agentAttributes['aws.region']).to.equal(process.env.AWS_REGION)
      expect(agentAttributes['aws.executionEnv']).to.equal(process.env.AWS_EXECUTION_ENV)

      done()
    }
  })

  it('should capture unknown event source attribute', function(done) {
    agent.on('transactionFinished', confirmAgentAttribute)

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.eventSource']).to.equal('Unknown')
      done()
    }
  })

  it('should capture kinesis data stream event source attribute', function(done) {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.kinesisDataStreamEvent

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.eventSource']).to.equal('Kinesis')
      done()
    }
  })

  it('should capture S3 PUT event source attribute', function(done) {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.s3PutEvent

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.eventSource']).to.equal('S3')
      done()
    }
  })

  it('should capture SNS event source attribute', function(done) {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.snsEvent

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.eventSource']).to.equal('SNS')
      done()
    }
  })

  it('should capture DynamoDB Update event source attribute', function(done) {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.dynamoDbUpdateEvent

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.eventSource']).to.equal('DynamoDB')
      done()
    }
  })

  it('should capture CodeCommit event source attribute', function(done) {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.codeCommitEvent

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.eventSource']).to.equal('CodeCommit')
      done()
    }
  })

  it('should capture CloudFront event source attribute', function(done) {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.cloudFrontEvent

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.eventSource']).to.equal('CloudFront')
      done()
    }
  })

  it('should capture CloudFormation Create Request event source attribute',
    function(done) {
      agent.on('transactionFinished', confirmAgentAttribute)

      stubEvent = lambdaSampleEvents.cloudFormationCreateRequestEvent

      const wrappedHandler = api.recordLambda(function(event, context, callback) {
        callback(null, 'worked')
      })

      wrappedHandler(stubEvent, stubContext, stubCallback)

      function confirmAgentAttribute(transaction) {
        const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

        expect(agentAttributes['aws.eventSource']).to.equal('CloudFormation')
        done()
      }
    }
  )

  it('should capture API Gateway Proxy Request event source attribute', function(done) {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.apiGatewayProxyEvent

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.eventSource']).to.equal('ApiGatewayProxy')
      done()
    }
  })

  it('should capture CloudWatch Logs event source attribute', function(done) {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.cloudWatchLogsEvent

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.eventSource']).to.equal('CloudWatchLogs')
      done()
    }
  })

  it('should capture Kinesis Data Firehose event source attribute', function(done) {
    agent.on('transactionFinished', confirmAgentAttribute)

    stubEvent = lambdaSampleEvents.kinesisDataFirehoseEvent

    const wrappedHandler = api.recordLambda(function(event, context, callback) {
      callback(null, 'worked')
    })

    wrappedHandler(stubEvent, stubContext, stubCallback)

    function confirmAgentAttribute(transaction) {
      const agentAttributes = transaction.trace.attributes.get(ATTR_DEST.TRANS_EVENT)

      expect(agentAttributes['aws.eventSource']).to.equal('KinesisFirehose')
      done()
    }
  })

  describe('when callback used', function() {
    it('should end appropriately', function() {
      let transaction

      const wrappedHandler = api.recordLambda(function(event, context, callback) {
        transaction = agent.tracer.getTransaction()
        callback(null, 'worked')
      })

      wrappedHandler(stubEvent, stubContext, function confirmEndCallback() {
        expect(transaction.isActive()).to.be.false

        const currentTransaction = agent.tracer.getTransaction()
        expect(currentTransaction).is.null
      })
    })

    it('should notice errors', function(done) {
      agent.on('transactionFinished', confirmErrorCapture)

      var wrappedHandler = api.recordLambda(function(event, context, callback) {
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

    it('should notice string errors', function(done) {
      agent.on('transactionFinished', confirmErrorCapture)

      var wrappedHandler = api.recordLambda(function(event, context, callback) {
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

  describe('when context.done used', function() {
    it('should end appropriately', function() {
      let transaction

      context.done = confirmEndCallback

      const wrappedHandler = api.recordLambda(function(event, context) {
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

    it('should notice errors', function(done) {
      agent.on('transactionFinished', confirmErrorCapture)

      var wrappedHandler = api.recordLambda(function(event, context) {
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

    it('should notice string errors', function(done) {
      agent.on('transactionFinished', confirmErrorCapture)

      var wrappedHandler = api.recordLambda(function(event, context) {
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

  describe('when context.succeed used', function() {
    it('should end appropriately', function() {
      let transaction

      context.succeed = confirmEndCallback

      const wrappedHandler = api.recordLambda(function(event, context) {
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

  describe('when context.fail used', function() {
    it('should end appropriately', function() {
      let transaction

      context.fail = confirmEndCallback

      const wrappedHandler = api.recordLambda(function(event, context) {
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

    it('should notice errors', function(done) {
      agent.on('transactionFinished', confirmErrorCapture)

      var wrappedHandler = api.recordLambda(function(event, context) {
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

    it('should notice string errors', function(done) {
      agent.on('transactionFinished', confirmErrorCapture)

      var wrappedHandler = api.recordLambda(function(event, context) {
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

