/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('../../logger').child({ component: 'azure-functions' })
const urltils = require('../../util/urltils')
const recordWeb = require('../../metrics/recorders/http')
const headerProcessing = require('../../header-processing')
const synthetics = require('../../synthetics')

const DESTS = require('../../config/attribute-filter').DESTINATIONS
const NAMES = require('../../metrics/names')

module.exports = function initialize(agent, azureFunctions, _moduleName, shim, { logger = defaultLogger } = {}) {
  const methods = ['http', 'get', 'put', 'post', 'patch', 'deleteRequest']
  shim.wrap(azureFunctions.app, methods, function wrapAzureHttpMethods(shim, appMethod) {
    return async function wrappedAzureHttpMethod(...args) {
      // TODO: handle case where first argument is the handler function ~ jsumners

      const handler = args[1].handler
      const tracer = shim.tracer
      const wrapped = tracer.transactionProxy(async function wrappedHandler(...args) {
        const [request, context] = args
        const ctx = tracer.getContext()
        const tx = tracer.getTransaction()

        tx.nameState.setPrefix(NAMES.NODEJS.PREFIX)
        tx.nameState.setDelimiter(NAMES.ACTION_DELIMITER)

        const url = new URL(request.url)
        const segment = tracer.createSegment({
          name: request.url,
          recorder: recordWeb,
          parent: ctx.segment,
          transaction: tx
        })
        segment.start()

        if (request.method != null) {
          segment.addSpanAttribute('request.method', request.method)
        }

        const transport = url.protocol === 'https:' ? 'HTTPS' : 'HTTP'
        tx.type = 'web'
        tx.baseSegment = segment
        tx.parsedUrl = url
        tx.url = urltils.obfuscatePath(agent.config, url.pathname)
        tx.verb = request.method
        if (url.port === '') {
          tx.port = transport === 'HTTPS' ? '443' : '80'
        } else {
          tx.port = url.port
        }

        tx.trace.attributes.addAttribute(
          DESTS.TRANS_EVENT | DESTS.ERROR_EVENT,
          'request.uri',
          tx.url
        )
        segment.addSpanAttribute('request.uri', tx.url)

        process._rawDebug('!!! function context:', JSON.stringify(context, null, 2))
        tx.trace.attributes.addAttribute(
          DESTS.TRANS_COMMON,
          'faas.invocation_id',
          context.invocationId ?? 'unknown'
        )
        tx.trace.attributes.addAttribute(
          DESTS.TRANS_COMMON,
          'faas.name',
          context.functionName ?? 'unknown'
        )
        tx.trace.attributes.addAttribute(
          DESTS.TRANS_COMMON,
          'faas.trigger',
          context.options.trigger.type ?? 'unknown'
        )

        const queueTimeStamp = headerProcessing.getQueueTime(logger, request.headers)
        if (queueTimeStamp) {
          tx.queueTime = Date.now() - queueTimeStamp
        }

        synthetics.assignHeadersToTransaction(agent.config, tx, request.headers)
        if (agent.config.distributed_tracing.enabled === true) {
          tx.acceptDistributedTraceHeaders(transport, request.headers)
        }

        const newContext = ctx.enterSegment({ segment })
        const boundHandler = tracer.bindFunction(handler, newContext)
        const result = await boundHandler(...args)
        tx.end()
        return result
      })
      args[1].handler = wrapped

      await appMethod(...args)
    }
  })
}
