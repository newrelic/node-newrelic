'use strict'

const logger = require('../logger').child({component: 'aws-lambda'})
const NAMES = require('../metrics/names')
const recordWeb = require('../metrics/recorders/http')
const recordBackground = require('../metrics/recorders/other')
const apiGateway = require('./aws-apiGateway')

var TransactionShim = require('../shim/transaction-shim')

const ATTR_DEST = require('../config/attribute-filter').DESTINATIONS

// A function with no references used to stub out closures
function cleanClosure() {}

const EVENT_SOURCE_ARN_KEY = 'aws.lambda.eventSource.arn'

const urltils = require('../util/urltils')
const headerAttributes = require('../header-attributes')

class AwsLambda {
  constructor(agent) {
    this.agent = agent
    this.shim = new TransactionShim(agent, 'aws-lambda')
    this._coldStartRecorded = false
  }

  patchLambdaHandler(handler) {
    const awsLambda = this
    const shim = this.shim

    if (typeof handler !== 'function') {
        logger.warn('handler argument is not a function and cannot be recorded')
        return handler
      }

      // this array holds all the closures used to end transactions
      var transactionEnders = []

      // There is no prependListener in node 4, so we wrap emit to look for 'beforeExit'
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

      return shim.bindCreateTransaction(wrappedHandler, {type: shim.BG})

      function wrappedHandler() {
        const args = shim.argsToArray.apply(shim, arguments)

        const event = args[0]
        const context = args[1]

        const functionName = context.functionName
        const group = NAMES.FUNCTION.PREFIX
        const transactionName = group + functionName

        const transaction = shim.tracer.getTransaction()
        transaction.setPartialName(transactionName)

        const isApiGatewayLambdaProxy = apiGateway.isLambdaProxyEvent(event)

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

        args[cbIndex] = wrapCallbackAndCaptureError(args[cbIndex], resultProcessor)
        context.done = wrapCallbackAndCaptureError(context.done)
        context.fail = wrapCallbackAndCaptureError(context.fail)

        const enderIndex = transactionEnders.push(end)

        const succeed = context.succeed
        context.succeed = function wrappedSucceed() {
          end()
          return succeed.apply(this, arguments)
        }

        const awsAttributes = getAwsAgentAttributes(event, context)
        if (!awsLambda._coldStartRecorded) {
          awsAttributes['aws.lambda.coldStart'] = true
          awsLambda._coldStartRecorded = true
        }

        transaction.trace.addAttributes(ATTR_DEST.TRANS_EVENT, awsAttributes)

        segment.start()

        return shim.applySegment(handler, segment, false, this, args)

        function wrapCallbackAndCaptureError(cb, processResult) {
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

            end()

            return cb.apply(this, arguments)
          }
        }

        function end() {
          segment.end()

          // Clear the end closure to let go of captured references
          transactionEnders[enderIndex] = cleanClosure

          transaction.finalizeName()

          transaction.end()
        }
      }
  }
}

function getAwsAgentAttributes(event, context) {
  const attributes = {
    'aws.lambda.arn': context.invokedFunctionArn,
    'aws.lambda.functionName': context.functionName,
    'aws.lambda.functionVersion': context.functionVersion,
    'aws.lambda.memoryLimit': context.memoryLimitInMB,
    'aws.region': process.env.AWS_REGION,
    'aws.requestId': context.awsRequestId
  }

  setEventSourceAttributes(event, attributes)

  return attributes
}

function setEventSourceAttributes(event, attributes) {
  if (event.Records) {
    const record = event.Records[0]
    if (record.eventSourceARN) {
      // SQS/Kinesis Stream/DynamoDB/CodeCommit
      attributes[EVENT_SOURCE_ARN_KEY] = record.eventSourceARN
    } else if (record.s3) {
      // S3
      if (record.s3.bucket && record.s3.bucket.arn) {
        attributes[EVENT_SOURCE_ARN_KEY] = record.s3.bucket.arn
      }
    } else if (record.EventSubscriptionArn) {
      // SNS
      attributes[EVENT_SOURCE_ARN_KEY] = record.EventSubscriptionArn
    }
  } else if (event.records && event.deliveryStreamArn) {
    // Kinesis Firehose
    attributes[EVENT_SOURCE_ARN_KEY] = event.deliveryStreamArn
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
  transaction.trace.addAttribute(ATTR_DEST.COMMON, 'request.method', request.method)
  transaction.port = request.url.port

  transaction.addRequestParameters(request.url.requestParameters)

  // URL is sent as an agent attribute with transaction events
  transaction.trace.addAttribute(
    ATTR_DEST.TRANS_EVENT | ATTR_DEST.ERROR_EVENT,
    'request.uri',
    request.url.path
  )

  headerAttributes.collectRequestHeaders(request.headers, transaction)

  if (shim.agent.config.distributed_tracing.enabled) {
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

function setWebResponse(transaction, response) {
  transaction.statusCode = response.statusCode

  const responseCode = String(response.statusCode)
  transaction.trace.addAttribute(
    ATTR_DEST.COMMON, 'httpResponseCode', responseCode
  )

  if (/^\d+$/.test(responseCode)) {
    transaction.trace.addAttribute(
        ATTR_DEST.COMMON,
      'response.status',
      responseCode)
  }

  headerAttributes.collectResponseHeaders(response.headers, transaction)
}

module.exports = AwsLambda
