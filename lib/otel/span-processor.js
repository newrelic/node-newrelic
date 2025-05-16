/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { hrTimeToMilliseconds } = require('@opentelemetry/core')
const { SpanKind } = require('@opentelemetry/api')

const AttributeReconciler = require('./attr-reconciler')
const SegmentSynthesizer = require('./segment-synthesis')
const { otelSynthesis } = require('../symbols')
const { DESTINATIONS } = require('../config/attribute-filter')
const { transformTemplate } = require('./segments/utils')
const urltils = require('../util/urltils')
const transformationRules = require('./transformation-rules')
const defaultLogger = require('../logger').child({ component: 'span-processor' })

const {
  DB_SYSTEM_VALUES,
  SPAN_STATUS_CODE
} = require('./constants')
const { dbAttr } = require('./attr-mapping/db')
const { clientMapper, httpAttr } = require('./attr-mapping/http')
const { msgAttr, producerMapper } = require('./attr-mapping/messaging')
const { faasAttr } = require('./attr-mapping/faas')
const { exceptionAttr } = require('./attr-mapping/exceptions')
const urlRules = {
  'server.port': (value) => value !== 80 && value !== 443 ? `:${value}` : '',
  'url.query': (value) => value.startsWith('?') ? value : `?${value}`
}

module.exports = class NrSpanProcessor {
  #reconciler

  constructor(agent, { logger = defaultLogger } = {}) {
    this.agent = agent
    this.synthesizer = new SegmentSynthesizer(agent)
    this.tracer = agent.tracer
    this.logger = logger

    this.#reconciler = new AttributeReconciler({ agent })
  }

  /**
   * Synthesize segment at start of span and assign to a symbol
   * that will be removed in `onEnd` once the corresponding
   * segment is read.
   * @param {object} span otel span getting tested
   */
  onStart(span) {
    span[otelSynthesis] = this.synthesizer.synthesize(span)
  }

  /**
   * Update the segment duration from span, handle errors and
   * reconcile any attributes that were added after the start
   * @param {object} span otel span getting updated
   */
  onEnd(span) {
    if (span[otelSynthesis] && span[otelSynthesis].segment) {
      const { segment, transaction, rule } = span[otelSynthesis]
      const transformationRule = transformationRules.find((tRule) => tRule.name === rule)
      this.updateDuration(segment, span)
      this.handleError({ segment, transaction, span })
      this.reconcileAttributes({ segment, span, transaction, transformationRule })
      delete span[otelSynthesis]
    }
  }

  handleError({ segment, transaction, span }) {
    if (span?.status?.code === SPAN_STATUS_CODE.ERROR) {
      const errorEvents = span.events.filter((event) => event.name === 'exception')
      errorEvents.forEach((err) => {
        const msg = exceptionAttr({ key: 'msg', span: err }) ?? `Error from ${segment.name}`
        const stack = exceptionAttr({ key: 'stack', span: err })
        const error = new Error(msg)
        error.stack = stack
        this.agent.errors.add(transaction, error, null, segment)
      })
    }
  }

  updateDuration(segment, span) {
    segment.touch()
    const duration = hrTimeToMilliseconds(span.duration)
    segment.overwriteDurationInMillis(duration)
  }

  reconcileAttributes({ segment, span, transaction, transformationRule }) {
    if (span.kind === SpanKind.SERVER || span.kind === SpanKind.CONSUMER) {
      this.reconcileServerConsumerAttributes({ segment, span, transaction, transformationRule })
    } else if (span.kind === SpanKind.CLIENT && dbAttr({ key: 'system', span })) {
      this.reconcileDbAttributes({ segment, span, transformationRule })
    } else if (span.kind === SpanKind.PRODUCER) {
      this.reconcileProducerAttributes({ segment, span })
    } else if (span.kind === SpanKind.CLIENT && httpAttr({ key: 'method', span })) {
      this.reconcileHttpExternalAttributes({ segment, span })
    } else {
      this.#reconciler.reconcile({ segment, otelSpan: span })
    }

    this.addAWSLinkingAttributes({ segment, span })
  }

  reconcileHttpExternalAttributes({ segment, span }) {
    const mapper = clientMapper({ segment })
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  mapAttributes({ segment, span, transaction, attributesMapper }) {
    const mapper = {}
    attributesMapper.forEach((attr) => {
      const { key, target, name, highSecurity } = attr
      mapper[key] = () => {}
      let value = span.attributes[key]
      if (this.#reconciler.isHostnameKey(key) === true) {
        value = this.#reconciler.resolveHost(value)
      }

      if (highSecurity && this.agent.config.high_security === true) {
        this.logger.debug(`Not adding attribute ${key} to ${target} because it gets dropped as part of high_security mode.`)
        return
      }

      if (target === 'transaction') {
        transaction[name] = value
      } else if (target === 'trace') {
        transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, name, value)
      } else if (target === 'segment') {
        segment.addAttribute(name, value)
      } else {
        this.logger.debug('Unknown attribute target', target)
      }
    })
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  finalizeTransaction({ segment, span, transaction, txTransformation }) {
    transaction.type = txTransformation.type
    const prefix = span.attributes[txTransformation?.name?.prefix]
    if (prefix) {
      transaction.nameState.setPrefix(prefix)
    }
    const verb = span.attributes[txTransformation?.name?.verb]
    if (verb) {
      transaction.nameState.setVerb(verb)
    }
    const route = span.attributes[txTransformation?.name?.path]
    if (route) {
      transaction.nameState.appendPath(route)
    }

    if (txTransformation?.name?.templatePath) {
      const value = transformTemplate(txTransformation.name.templatePath, span.attributes)
      transaction.nameState.appendPath(value)
    }

    if (txTransformation?.name?.templateValue) {
      const value = transformTemplate(txTransformation.name.templateValue, span.attributes)
      transaction.setPartialName(value)
      segment.setNameFromTransaction(transaction)
    }

    if (txTransformation?.name?.value) {
      transaction.setPartialName(txTransformation.name.value)
      segment.setNameFromTransaction(transaction)
    }

    if (transaction.type === 'web') {
      this.finalizeWebTransaction({ span, transaction, txTransformation })
    }

    // End the corresponding transaction for the entry point server span.
    // We do then when the span ends to ensure all data has been processed
    // for the corresponding server span.
    transaction.end()
  }

  finalizeWebTransaction({ span, transaction, txTransformation }) {
    let httpUrl
    if (txTransformation.url?.template) {
      httpUrl = transformTemplate(txTransformation.url.template, span.attributes, urlRules)
    } else if (txTransformation?.url?.key) {
      httpUrl = span.attributes[txTransformation.url.key]
    }

    try {
      const requestUrl = new URL(httpUrl)
      transaction.parsedUrl = requestUrl
      transaction.url = urltils.obfuscatePath(this.agent.config, requestUrl.pathname)
      transaction.applyUserNamingRules(requestUrl.pathname)
    } catch {
      transaction.url = httpUrl
    }

    transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'request.uri', transaction.url)

    // If `http.route` was not emitted on server span, name the transaction from the path
    // to avoid transactions being named `*`
    if (transaction.parsedUrl) {
      transaction.nameState.appendPathIfEmpty(transaction.parsedUrl?.path)
    }

    // Add the status code to transaction name
    if (transaction.statusCode) {
      transaction.finalizeNameFromUri(transaction.parsedUrl, transaction.statusCode)
    }
  }

  reconcileServerConsumerAttributes({ segment, span, transaction, transformationRule }) {
    const { transaction: txTransformation, attributes: attributesMapper } = transformationRule
    this.mapAttributes({ segment, span, transaction, attributesMapper })
    this.finalizeTransaction({ segment, span, transaction, txTransformation })
  }

  reconcileDbAttributes({ segment, span, transformationRule }) {
    const { attributes: attributesMapper } = transformationRule
    this.mapAttributes({ segment, span, attributesMapper })
  }

  reconcileProducerAttributes({ segment, span }) {
    const mapper = producerMapper({ segment })
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  addAWSLinkingAttributes({ segment, span }) {
    const accountId = this.agent?.config?.cloud?.aws?.account_id
    const region = faasAttr({ key: 'region', span })
    const serviceName = httpAttr({ key: 'rpcService', span })

    // DynamoDB
    if (dbAttr({ key: 'system', span }) === DB_SYSTEM_VALUES.DYNAMODB ||
      serviceName?.toLowerCase() === 'dynamodb'
    ) {
      const value = dbAttr({ key: 'dynamoTable', span })
      const collection = value?.[0]
      if (region && accountId && collection) {
        segment.addAttribute('cloud.resource_id', `arn:aws:dynamodb:${region}:${accountId}:table/${collection}`)
      }
    }

    // Lambda
    if (faasAttr({ key: 'provider', span }) === 'aws') {
      const functionName = faasAttr({ key: 'name', span })
      if (region && accountId && functionName) {
        segment.addAttribute('cloud.platform', 'aws_lambda')
        segment.addAttribute('cloud.resource_id', `arn:aws:lambda:${region}:${accountId}:function:${functionName}`)
      }
    }

    // SQS
    if (serviceName?.toLowerCase() === 'sqs') {
      if (accountId) {
        segment.addAttribute('cloud.account.id', accountId)
      }
      if (region) {
        segment.addAttribute('cloud.region', region)
      }
      const messagingDestination = msgAttr({ key: 'destination', span })
      segment.addAttribute('messaging.destination.name', messagingDestination)
      segment.addAttribute('messaging.system', 'aws_sqs')
    }
  }
}
