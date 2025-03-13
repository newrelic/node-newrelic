/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const apiGateway = require('./api-gateway')
const headerAttributes = require('../header-attributes')
const get = require('../util/get')
const logger = require('../logger').child({ component: 'aws-lambda' })
const recordBackground = require('../metrics/recorders/other')
const recordWeb = require('../metrics/recorders/http')
const TransactionShim = require('../shim/transaction-shim')
const urltils = require('../util/urltils')
const specs = require('../shim/specs')

// CONSTANTS
const ATTR_DEST = require('../config/attribute-filter').DESTINATIONS
const COLD_START_KEY = 'aws.lambda.coldStart'
const EVENT_SOURCE_PREFIX = 'aws.lambda.eventSource'
const EVENT_SOURCE_ARN_KEY = `${EVENT_SOURCE_PREFIX}.arn`
const EVENT_SOURCE_TYPE_KEY = `${EVENT_SOURCE_PREFIX}.eventType`
const NAMES = require('../metrics/names')

const EVENT_SOURCE_INFO = require('./event-sources')
const HANDLER_STREAMING = Symbol.for('aws.lambda.runtime.handler.streaming')

// A function with no references used to stub out closures
function cleanClosure() {}

// this array holds all the closures used to end transactions
let transactionEnders = []

// this tracks unhandled exceptions to be able to relate them back to
// the invocation transaction.
let uncaughtException = null

// Tracking the first time patchLambdaHandler is called for one-off functionality
let patchCalled = false
let coldStartRecorded = false

class AwsLambda {
  constructor(agent) {
    this.agent = agent
    this.shim = new TransactionShim(agent, 'aws-lambda')
  }

  // FOR TESTING PURPOSES ONLY
  _resetModuleState() {
    patchCalled = false
    coldStartRecorded = false
    transactionEnders = []
  }

  _detectEventType(event) {
    const pathMatch = (obj, path) => {
      return get(obj, path, null) !== null
    }

    for (const typeInfo of Object.values(EVENT_SOURCE_INFO)) {
      if (typeInfo.required_keys.every((path) => pathMatch(event, path))) {
        return typeInfo
      }
    }

    return null
  }

  wrapEnders() {
    const shim = this.shim
    // There is no prependListener in node 4, so we wrap emit to look for 'beforeExit'
    // NOTE: This may be converted to holding onto a single ender function if only
    // one invocation is executing at a time.
    shim.wrap(process, 'emit', function wrapEmit(shim, emit) {
      return function wrappedEmit(ev, error) {
        // need to add error as uncaughtException to be used
        // later to add to transaction errors
        if (ev === 'unhandledRejection') {
          uncaughtException = error
        }

        if (['beforeExit', 'unhandledRejection'].includes(ev)) {
          transactionEnders.forEach((ender) => {
            ender()
          })
          transactionEnders = []
        }
        return emit.apply(process, arguments)
      }
    })
  }

  wrapFatal() {
    const shim = this.shim
    shim.wrap(process, '_fatalException', function wrapper(shim, original) {
      return function wrappedFatalException(error) {
        // logic placed before the _fatalException call, since it ends the invocation
        uncaughtException = error
        transactionEnders.forEach((ender) => {
          ender()
        })
        transactionEnders = []
        return original.apply(this, arguments)
      }
    })
  }

  /**
   * Response-streaming handlers are identified by symbol properties on the function.
   * We propagate any symbols if they're present, so that the handler keeps its signatue for any AWS features that rely on symbols
   * @param handler
   * @param nrHandler
   */
  propagateSymbols(handler, nrHandler) {
    for (const symbol of Object.getOwnPropertySymbols(handler)) {
      logger.trace(`Setting symbol ${symbol.toString()} on handler`)
      nrHandler[symbol] = handler[symbol]
    }
  }

  createSegment({ event, context, transaction, recorder }) {
    const shim = this.shim
    const functionName = context.functionName
    const group = NAMES.FUNCTION.PREFIX
    const transactionName = group + functionName

    const activeSegment = shim.tracer.getSegment()

    transaction.setPartialName(transactionName)
    const txnEnder = endTransaction.bind(null, transaction, transactionEnders.length)

    transactionEnders.push(txnEnder)
    const segment = shim.createSegment(functionName, recorder, activeSegment)
    transaction.baseSegment = segment
    const awsAttributes = this._getAwsAgentAttributes(event, context)
    transaction.trace.attributes.addAttributes(ATTR_DEST.TRANS_COMMON, awsAttributes)

    shim.agent.setLambdaArn(context.invokedFunctionArn)

    shim.agent.setLambdaFunctionVersion(context.functionVersion)
    segment.addSpanAttributes(awsAttributes)

    segment.start()
    return { segment, txnEnder }
  }

  patchLambdaHandler(handler) {
    const awsLambda = this
    const shim = this.shim

    if (typeof handler !== 'function') {
      logger.warn('handler argument is not a function and cannot be recorded')
      return handler
    }

    const isStreamHandler = handler[HANDLER_STREAMING] === 'response'
    if (isStreamHandler) {
      this.agent.recordSupportability('Nodejs/Serverless/Lambda/ResponseStreaming')
    }

    if (!patchCalled) {
      // Only wrap emit on process the first time patch is called.
      patchCalled = true

      this.wrapEnders()
      this.wrapFatal()
    }

    const wrapper = isStreamHandler ? wrappedStreamHandler : wrappedHandler
    const nrHandler = shim.bindCreateTransaction(wrapper, new specs.TransactionSpec({ type: shim.BG }))
    awsLambda.propagateSymbols(handler, nrHandler)

    return nrHandler

    /**
     * Wraps a response streaming lambda handler.
     *
     * Creates and applies segment based on function name, assigns attributes to transaction trace,
     * listen when stream errors(log error), ends(end transaction)
     *
     * **Note**: AWS doesn't support response streaming with API gateway invoked lambdas.
     * This means we do not handle that as it would require intercepting the stream to parse
     * the response code and headers.
     */
    function wrappedStreamHandler() {
      const transaction = shim.tracer.getTransaction()
      if (!transaction) {
        logger.trace('No active transaction, not wrapping streaming handler')
        return handler.apply(this, arguments)
      }

      const args = shim.argsToArray.apply(shim, arguments)
      const event = args[0]
      const context = args[2]
      logger.trace('In stream handler, lambda function name', context?.functionName)
      const { segment, txnEnder } = awsLambda.createSegment({ context, event, transaction, recorder: recordBackground })
      args[1] = awsLambda.wrapStreamAndCaptureError(
        transaction,
        txnEnder,
        args[1]
      )

      let res
      try {
        res = shim.applySegment(handler, segment, false, this, args)
      } catch (err) {
        uncaughtException = err
        txnEnder()
        throw err
      }

      return res
    }

    /**
     * Wraps a non response streaming lambda handler.
     *
     * Creates and applies segment based on function name, assigns attributes to transaction trace,
     * adds handlers if api gateway to wrap request/response
     * wraps the callback(if present), wraps the context `done`, `succeed`, `fail methods`, intercepts promise
     * and properly ends transaction
     */
    function wrappedHandler() {
      const transaction = shim.tracer.getTransaction()
      if (!transaction) {
        logger.trace('No active transaction, not wrapping handler')
        return handler.apply(this, arguments)
      }
      const args = shim.argsToArray.apply(shim, arguments)

      const event = args[0]
      const context = args[1]
      logger.trace('Lambda function name', context?.functionName)
      const isApiGatewayLambdaProxy = apiGateway.isLambdaProxyEvent(event)
      logger.trace('Is this Lambda event an API Gateway or ALB web proxy?', isApiGatewayLambdaProxy)
      logger.trace('Lambda event keys', Object.keys(event))
      const segmentRecorder = isApiGatewayLambdaProxy ? recordWeb : recordBackground
      const { segment, txnEnder } = awsLambda.createSegment({ context, event, transaction, recorder: segmentRecorder })

      // resultProcessor is used to execute additional logic based on the
      // payload supplied to the callback.
      let resultProcessor

      if (isApiGatewayLambdaProxy) {
        const webRequest = new apiGateway.LambdaProxyWebRequest(event)
        setWebRequest(shim, transaction, webRequest)
        resultProcessor = getApiGatewayLambdaProxyResultProcessor(transaction)
      }
      const cbIndex = args.length - 1
      args[cbIndex] = awsLambda.wrapCallbackAndCaptureError(
        transaction,
        txnEnder,
        args[cbIndex],
        resultProcessor
      )

      // context.{done,fail,succeed} are all considered deprecated by
      // AWS, but are considered functional.
      context.done = awsLambda.wrapCallbackAndCaptureError(transaction, txnEnder, context.done)
      context.fail = awsLambda.wrapCallbackAndCaptureError(transaction, txnEnder, context.fail)
      shim.wrap(context, 'succeed', function wrapSucceed(shim, original) {
        return function wrappedSucceed() {
          txnEnder()
          return original.apply(this, arguments)
        }
      })

      let res
      try {
        res = shim.applySegment(handler, segment, false, this, args)
      } catch (err) {
        uncaughtException = err
        txnEnder()
        throw err
      }
      if (shim.isPromise(res)) {
        res = lambdaInterceptPromise(res, resultProcessor, txnEnder)
      }
      return res
    }

    // In order to capture error events
    // we need to store the error in uncaughtException
    // otherwise the transaction will end before they are captured
    function lambdaInterceptPromise(prom, resultProcessor, cb) {
      prom.then(
        function onThen(arg) {
          if (resultProcessor) {
            resultProcessor(arg)
          }
          cb()
        },
        function onCatch(err) {
          uncaughtException = err
          cb()
        }
      )
      return prom
    }
  }

  wrapCallbackAndCaptureError(transaction, txnEnder, cb, processResult) {
    const shim = this.shim
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

  wrapStreamAndCaptureError(transaction, txnEnder, stream) {
    const shim = this.shim
    stream.on('error', (error) => {
      shim.agent.errors.add(transaction, error)
    })

    stream.on('close', () => {
      txnEnder()
    })
    return stream
  }

  _getAwsAgentAttributes(event, context) {
    const attributes = {
      'aws.lambda.arn': context.invokedFunctionArn,
      'aws.requestId': context.awsRequestId
    }

    const eventSourceInfo = this._detectEventType(event)

    if (eventSourceInfo) {
      attributes[EVENT_SOURCE_TYPE_KEY] = eventSourceInfo.name

      for (const key of Object.keys(eventSourceInfo.attributes)) {
        const value = get(event, eventSourceInfo.attributes[key], null)

        if (value === null) {
          continue
        }

        attributes[key] = value
      }
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
  } else if (
    event.requestContext &&
    event.requestContext.elb &&
    event.requestContext.elb.targetGroupArn
  ) {
    attributes[EVENT_SOURCE_ARN_KEY] = event.requestContext.elb.targetGroupArn
  } else if (event.resources && event.resources[0]) {
    attributes[EVENT_SOURCE_ARN_KEY] = event.resources[0]
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

  const segment = transaction.baseSegment

  transaction.url = urltils.scrub(request.url.path)
  transaction.verb = request.method
  transaction.trace.attributes.addAttribute(
    ATTR_DEST.TRANS_COMMON,
    'request.method',
    request.method
  )

  segment.addSpanAttribute('request.method', request.method)

  transaction.port = request.url.port

  // These are only query parameters, from lib/serverless/api-gateway.js
  transaction.addRequestParameters(request.url.requestParameters)

  // URL is sent as an agent attribute with transaction events
  transaction.trace.attributes.addAttribute(
    ATTR_DEST.TRANS_EVENT | ATTR_DEST.ERROR_EVENT,
    'request.uri',
    request.url.path
  )

  segment.addSpanAttribute('request.uri', request.url.path)

  headerAttributes.collectRequestHeaders(request.headers, transaction)

  if (shim.agent.config.distributed_tracing.enabled) {
    const lowercaseHeaders = lowercaseObjectKeys(request.headers)

    const transportType = request.transportType && request.transportType.toUpperCase()
    transaction.acceptDistributedTraceHeaders(transportType, lowercaseHeaders)
  }
}

function lowercaseObjectKeys(original) {
  return Object.keys(original).reduce((destination, key) => {
    destination[key.toLowerCase()] = original[key]
    return destination
  }, {})
}

function endTransaction(transaction, enderIndex) {
  if (transactionEnders.length === 0 || transactionEnders[enderIndex] === cleanClosure) {
    // In the case where we have already been called, we return early. There may be a
    // case where this is called more than once, given the lambda is left in a dirty
    // state after thread suspension (e.g. timeouts)
    return
  }

  if (uncaughtException !== null) {
    transaction.agent.errors.add(transaction, uncaughtException)
    uncaughtException = null
  }

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

  if (/^\d+$/.test(responseCode)) {
    transaction.trace.attributes.addAttribute(
      ATTR_DEST.TRANS_COMMON,
      'http.statusCode',
      responseCode
    )

    // We are adding http.statusCode to base segment as
    // we found in testing async invoked lambdas, the
    // active segment is not available at this point.
    const segment = transaction.baseSegment

    segment.addSpanAttribute('http.statusCode', responseCode)
  }

  headerAttributes.collectResponseHeaders(response.headers, transaction)
}

module.exports = AwsLambda
