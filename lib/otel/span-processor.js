/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { hrTimeToMilliseconds } = require('@opentelemetry/core')
const { SpanKind } = require('@opentelemetry/api')
const urltils = require('../util/urltils')

const AttributeReconciler = require('./attr-reconciler')
const SegmentSynthesizer = require('./segment-synthesis')
const { otelSynthesis } = require('../symbols')
const { DESTINATIONS } = require('../config/attribute-filter')
const { assignToTarget, buildRuleMappings, extractAttributeValue, processRegex, transformTemplate } = require('./utils')
const defaultLogger = require('../logger').child({ component: 'span-processor' })

const {
  SPAN_STATUS_CODE
} = require('./constants')
const exceptionAttr = require('./exception-mapping')

module.exports = class NrSpanProcessor {
  #reconciler

  constructor(agent, { logger = defaultLogger } = {}) {
    this.agent = agent
    this.accountId = agent?.config?.cloud?.aws?.account_id
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
   * map and reconcile any attributes that were to span.
   * @param {object} span otel span getting updated
   */
  onEnd(span) {
    if (span[otelSynthesis] && span[otelSynthesis].segment) {
      const { segment, transaction, rule } = span[otelSynthesis]
      this.updateDuration(segment, span)
      this.handleError({ segment, transaction, span })
      this.reconcileAttributes({ segment, span, transaction, rule })
      delete span[otelSynthesis]
    }
  }

  /**
   * Adds an error to the transaction if the span has a status code of ERROR
   * and the span has an exception event. The error is created from the exception
   * event attributes and added to the transaction.
   * @param {object} params - The parameters for the error handling.
   * @param {object} params.segment - The segment to add the error to.
   * @param {object} params.transaction - The transaction to add the error to.
   * @param {object} params.span - The span to check for errors.
   */
  handleError({ segment, transaction, span }) {
    if (span?.status?.code === SPAN_STATUS_CODE.ERROR) {
      const errorEvents = span.events.filter((event) => event.name === 'exception')
      for (const err of errorEvents) {
        const msg = exceptionAttr({ key: 'msg', span: err }) ?? `Error from ${segment.name}`
        const stack = exceptionAttr({ key: 'stack', span: err })
        const error = new Error(msg)
        error.stack = stack
        this.agent.errors.add(transaction, error, null, segment)
      }
    }
  }

  /**
   * Updates the segment duration from the span duration
   * @param {object} segment - The segment to update.
   * @param {object} span - The span to get the duration from.
   */
  updateDuration(segment, span) {
    segment.touch()
    const duration = hrTimeToMilliseconds(span.duration)
    segment.overwriteDurationInMillis(duration)
  }

  /**
   * Adds attributes to the segment, transaction or trace based on the
   * transformation rule. If the span is a server or consumer span,
   * it will also finalize the transaction.
   * @param {object} params - The parameters for the reconciliation.
   * @param {object} params.segment - The segment to add attributes to.
   * @param {object} params.span - The span to add attributes from.
   * @param {object} params.transaction - The transaction to add attributes to.
   * @param {object} params.rule - The transformation rule to use.
   */
  reconcileAttributes({ segment, span, transaction, rule = {} }) {
    this.mapAttributes({ segment, span, transaction, rule })

    if (span.kind === SpanKind.SERVER || span.kind === SpanKind.CONSUMER) {
      this.finalizeTransaction({ segment, span, transaction, rule, config: this.agent.config })
    }
  }

  /**
   * Maps attributes from the span to the segment, transaction or trace
   * based on the transformation rule.
   * @param {object} params - The parameters for the mapping.
   * @param {object} params.segment - The segment to add attributes to.
   * @param {object} params.span - The span to add attributes from.
   * @param {object} params.transaction - The transaction to add attributes to.
   * @param {object} params.rule - The transformation rule to use.
   */
  mapAttributes({ segment, span, transaction, rule }) {
    const excludeAttributes = new Set()
    for (const attribute of rule.attributes) {
      const { key, target, name, highSecurity, regex } = attribute
      let value = extractAttributeValue({ accountId: this.accountId, attribute, excludeAttributes, span })

      if (this.#reconciler.isHostnameKey(key) === true) {
        value = this.#reconciler.resolveHost(value)
      }

      if (regex) {
        processRegex({ segment, transaction, regex, value })
        continue
      }

      if (highSecurity && this.agent.config.high_security === true) {
        this.logger.debug(`Not adding attribute ${key} to ${target} because it gets dropped as part of high_security mode.`)
        continue
      }

      assignToTarget({ target, name, value, segment, transaction, span })
    }

    this.#reconciler.reconcile({ segment, otelSpan: span, excludeAttributes })
  }

  /**
   * Finalizes the transaction by setting the type, name and URL.
   * If the transaction is a web transaction, it will also set the URL and
   * finalize the name from the URL.
   * @param {object} params - The parameters for the finalization.
   * @param {object} params.rule - The transformation rule to use.
   * @param {object} params.segment - The segment to finalize.
   * @param {object} params.span - The span to pull attributes from.
   * @param {object} params.transaction - The transaction to finalize.
   */
  finalizeTransaction({ rule, segment, span, transaction }) {
    const txTransformation = rule.txTransformation
    transaction.type = txTransformation?.type
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

  /**
   * Finalizes the web transaction by setting the URL and name.
   * @param {object} params - The parameters for the finalization.
   * @param {object} params.span - The span to pull attributes from.
   * @param {object} params.transaction - The transaction to finalize.
   * @param {object} params.txTransformation - The transformation rule to use.
   */
  finalizeWebTransaction({ span, transaction, txTransformation }) {
    let httpUrl
    if (txTransformation.url?.template) {
      const rules = buildRuleMappings(txTransformation?.url?.mappings)
      httpUrl = transformTemplate(txTransformation.url.template, span.attributes, rules)
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
}
