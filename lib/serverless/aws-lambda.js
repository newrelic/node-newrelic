'use strict'

const apiGateway = require('./api-gateway')
const headerAttributes = require('../header-attributes')
const logger = require('../logger').child({component: 'aws-lambda'})
const recordBackground = require('../metrics/recorders/other')
const recordWeb = require('../metrics/recorders/http')
const TransactionShim = require('../shim/transaction-shim')
const urltils = require('../util/urltils')

// CONSTANTS
const ATTR_DEST = require('../config/attribute-filter').DESTINATIONS
const COLD_START_KEY = 'aws.lambda.coldStart'
const EVENT_SOURCE_ARN_KEY = 'aws.lambda.eventSource.arn'
const NAMES = require('../metrics/names')


// A function with no references used to stub out closures
function cleanClosure() {}

// this array holds all the closures used to end transactions
let transactionEnders = []

// Tracking the first time patchLambdaHandler is called for one off functionality
let patchCalled = false
let coldStartRecorded = false

class AwsLambda {
  constructor(agent) {
    this.agent = agent
    this.shim = new TransactionShim(agent, 'aws-lambda')
  }

  // FOR TESTING PURPORSES ONLY
  _resetModuleState() {
    patchCalled = false
    coldStartRecorded = false
    transactionEnders = []
  }

  patchLambdaHandler(handler) {
    const awsLambda = this
    const shim = this.shim

    if (typeof handler !== 'function') {
      logger.warn('handler argument is not a function and cannot be recorded')
      return handler
    }

    if (!patchCalled) {
      // Only wrap emit on process the first time patch is called.
      patchCalled = true

      // There is no prependListener in node 4, so we wrap emit to look for 'beforeExit'
      // NOTE: This may be converted to holding onto a single ender function if only
      // one invocation is executing at a time.
      shim.wrap(process, 'emit', function wrapEmit(shim, emit) {
        return function wrappedEmit(ev) {
          if (ev === 'beforeExit') {
            transactionEnders.forEach((ender) => {
              ender()
            })
            transactionEnders = []
          }
          return emit.apply(process, arguments)
        }
      })
    }

    return shim.bindCreateTransaction(wrappedHandler, {type: shim.BG})

    function wrappedHandler() {
      const args = shim.argsToArray.apply(shim, arguments)

      const event = args[0]
      const context = args[1]

      const functionName = context.functionName
      const group = NAMES.FUNCTION.PREFIX
      const transactionName = group + functionName

      const transaction = shim.tracer.getTransaction()
      if (!transaction) {
        return handler.apply(this, arguments)
      }

      transaction.setPartialName(transactionName)

      const isApiGatewayLambdaProxy = apiGateway.isLambdaProxyEvent(event)

      // resultProcessor is used to execute additional logic based on the
      // payload supplied to the callback.
      let resultProcessor
      if (isApiGatewayLambdaProxy) {
        const webRequest = new apiGateway.LambdaProxyWebRequest(event)
        setWebRequest(shim, transaction, webRequest)
        resultProcessor = getApiGatewayLambdaProxyResultProcessor(transaction)
      }

      const segmentRecorder = isApiGatewayLambdaProxy ? recordWeb : recordBackground
      const segment = shim.createSegment(functionName, segmentRecorder)
      transaction.baseSegment = segment

      const cbIndex = args.length - 1

      // Add transaction ending closure to the list of functions to be called on
      // beforeExit (i.e. in the case that context.{done,fail,succeed} or callback
      // were not called).
      const txnEnder = endTransaction.bind(
        null,
        transaction,
        transactionEnders.length
      )

      transactionEnders.push(txnEnder)

      args[cbIndex] = wrapCallbackAndCaptureError(
        transaction,
        txnEnder,
        args[cbIndex],
        resultProcessor
      )

      // context.{done,fail,succeed} are all considered deprecated by
      // AWS, but are considered functional.
      context.done = wrapCallbackAndCaptureError(transaction, txnEnder, context.done)
      context.fail = wrapCallbackAndCaptureError(transaction, txnEnder, context.fail)
      shim.wrap(context, 'succeed', function wrapSucceed(shim, original) {
        return function wrappedSucceed() {
          txnEnder()
          return original.apply(this, arguments)
        }
      })

      const awsAttributes = awsLambda._getAwsAgentAttributes(event, context)
      transaction.trace.attributes.addAttributes(
        ATTR_DEST.TRANS_COMMON,
        awsAttributes
      )

      shim.agent.setLambdaArn(context.invokedFunctionArn)

      segment.start()

      return shim.applySegment(handler, segment, false, this, args)
    }

    function wrapCallbackAndCaptureError(transaction, txnEnder, cb, processResult) {
      return function wrappedCallback() {
        let err = arguments[0]
        if (typeof err === 'string') {
          err = new Error(err)
        }

        shim.agent.errors.add(transaction, err)

        if (processResult) {
          const result = arguments[1]
          processResult(result)
        }

        txnEnder()

        return cb.apply(this, arguments)
      }
    }
  }

  _getAwsAgentAttributes(event, context) {
    const attributes = {
      'aws.lambda.arn': context.invokedFunctionArn,
      'aws.requestId': context.awsRequestId
    }

    setEventSourceAttributes(event, attributes)

    if (!coldStartRecorded) {
      coldStartRecorded = attributes[COLD_START_KEY] = true
    }

    return attributes
  }
}

function setEventSourceAttributes(event, attributes) {
  if (event.Records) {
    const record = event.Records[0]
    if (record.eventSourceARN) {
      // SQS/Kinesis Stream/DynamoDB/CodeCommit
      attributes[EVENT_SOURCE_ARN_KEY] = record.eventSourceARN
    } else if (record.s3 && record.s3.bucket && record.s3.bucket.arn) {
      // S3
      attributes[EVENT_SOURCE_ARN_KEY] = record.s3.bucket.arn
    } else if (record.EventSubscriptionArn) {
      // SNS
      attributes[EVENT_SOURCE_ARN_KEY] = record.EventSubscriptionArn
    } else {
      logger.trace('Unable to determine ARN from event record.', event, record)
    }
  } else if (event.records && event.deliveryStreamArn) {
    // Kinesis Firehose
    attributes[EVENT_SOURCE_ARN_KEY] = event.deliveryStreamArn
  } else {
    logger.trace('Unable to determine ARN for event type.', event)
  }
}

function getApiGatewayLambdaProxyResultProcessor(transaction) {
  return function processApiGatewayLambdaProxyResponse(response) {
    if (apiGateway.isValidLambdaProxyResponse(response)) {
      const webResponse = new apiGateway.LambdaProxyWebResponse(response)
      setWebResponse(transaction, webResponse)
    } else {
      logger.debug('Did not contain a valid API Gateway Lambda Proxy response.')
    }
  }
}

function setWebRequest(shim, transaction, request) {
  transaction.type = shim.WEB

  transaction.url = urltils.scrub(request.url.path)
  transaction.verb = request.method
  transaction.trace.attributes.addAttribute(
    ATTR_DEST.TRANS_COMMON,
    'request.method',
    request.method
  )
  transaction.port = request.url.port

  transaction.addRequestParameters(request.url.requestParameters)

  // URL is sent as an agent attribute with transaction events
  transaction.trace.attributes.addAttribute(
    ATTR_DEST.TRANS_EVENT | ATTR_DEST.ERROR_EVENT,
    'request.uri',
    request.url.path
  )

  headerAttributes.collectRequestHeaders(request.headers, transaction)

  if (shim.agent.config.distributed_tracing.enabled) {
    // These are the three cases specified in the DT spec
    // https://source.datanerd.us/agents/agent-specs/blob/master/Distributed-Tracing.md#supported-transports
    const payload = request.headers.newrelic || request.headers.NEWRELIC ||
      request.headers.Newrelic

    if (payload) {
      logger.trace(
        'Accepting distributed trace payload for transaction %s',
        transaction.id
      )
      transaction.acceptDistributedTracePayload(payload, request.transportType)
    }
  }
}

function endTransaction(transaction, enderIndex) {
  transaction.baseSegment.end()

  // Clear the end closure to let go of captured references
  transactionEnders[enderIndex] = cleanClosure
  transaction.finalizeName()
  transaction.end()
  try {
    transaction.agent.harvestSync()
  } catch (err) {
    logger.warn('Failed to harvest transaction', err)
  }
}

function setWebResponse(transaction, response) {
  transaction.statusCode = response.statusCode

  const responseCode = String(response.statusCode)
  transaction.trace.attributes.addAttribute(
    ATTR_DEST.TRANS_COMMON,
    'httpResponseCode',
    responseCode
  )

  if (/^\d+$/.test(responseCode)) {
    transaction.trace.attributes.addAttribute(
      ATTR_DEST.TRANS_COMMON,
      'response.status',
      responseCode)
  }

  headerAttributes.collectResponseHeaders(response.headers, transaction)
}

module.exports = AwsLambda
