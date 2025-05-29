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
const defaultLogger = require('../logger').child({ component: 'span-processor' })

const {
  SPAN_STATUS_CODE
} = require('./constants')
const exceptionAttr = require('./exception-mapping')

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
      errorEvents.forEach((err) => {
        const msg = exceptionAttr({ key: 'msg', span: err }) ?? `Error from ${segment.name}`
        const stack = exceptionAttr({ key: 'stack', span: err })
        const error = new Error(msg)
        error.stack = stack
        this.agent.errors.add(transaction, error, null, segment)
      })
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
      this.finalizeTransaction({ segment, span, transaction, rule })
    }
  }

  buildRuleMappings(mappings = []) {
    return mappings.reduce((acc, attr) => {
      if (attr?.key && attr?.arguments && attr?.body) {
        // eslint-disable-next-line no-new-func,sonarjs/code-eval
        acc[attr.key] = new Function(attr.arguments, attr.body)
      }
      return acc
    }, {})
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
    const attributesMapper = rule.attributes
    const mapper = {}
    attributesMapper.forEach((attr) => {
      const { key, target, name, highSecurity, template, regex } = attr
      let value
      if (key) {
        mapper[key] = () => {}
        value = span.attributes[key]
      } else if (attr.value) {
        mapper[name] = () => {}
        value = attr.value
      } else {
        const accountId = this.agent?.config?.cloud?.aws?.account_id
        const rules = this.buildRuleMappings(attr?.mappings)
        value = transformTemplate(template, { ...span?.attributes, accountId }, rules)
        if (regex) {
          this.processRegex({ segment, regex, value, mapper })
          return
        }
      }
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

  /**
   * Processes a regex match and adds attributes to the segment based on the regex groups.
   * @param {object} params - The parameters for the regex processing.
   * @param {object} params.segment - The segment to add attributes to.
   * @param {object} params.regex - The regex to use for matching.
   * @param {string} params.value - The value to match against the regex.
   * @param {object} params.mapper - The mapper to use for adding attributes.
   */
  processRegex({ segment, regex, value, mapper }) {
    const re = new RegExp(regex.statement, regex.flags)
    let regexMatches
    if (regex?.flags?.includes('g') === true) {
      regexMatches = Array.from(value.matchAll(re))
    } else {
      const regexMatch = value.match(re)
      regexMatches = regexMatch ? [regexMatch] : []
    }

    if (regexMatches.length) {
      for (const regexMatch of regexMatches) {
        this.processRegexGroups({ segment, groups: regex.groups, regexMatch, mapper })

        if (regex?.name && regex?.value && regex.prefix) {
          segment.addAttribute(`${regex.prefix}${regexMatch[regex.name]}`, regexMatch[regex.value])
        }
      }
    }
  }

  /**
   * Processes the regex groups and adds attributes to the segment based on the regex match.
   * @param {object} params - The parameters for the regex group processing.
   * @param {object} params.segment - The segment to add attributes to.
   * @param {Array} params.groups - The regex groups to process.
   * @param {object} params.regexMatch - The regex match object containing the matched groups.
   * @param {object} params.mapper - The mapper to use for adding attributes.
   */
  processRegexGroups({ segment, groups = [], regexMatch, mapper }) {
    for (const g of groups) {
      if (g?.key) {
        mapper[g.key] = () => {}
      }

      const value = regexMatch[g.group]
      if (g?.regex?.statement && value) {
        this.processRegex({ segment, regex: g.regex, value })
      } else if (g?.name && value) {
        segment.addAttribute(g.name, value)
      }
    }
  }

  /**
   * Finalizes the transaction by setting the type, name and URL.
   * If the transaction is a web transaction, it will also set the URL and
   * finalize the name from the URL.
   * @param {object} params - The parameters for the finalization.
   * @param {object} params.segment - The segment to finalize.
   * @param {object} params.span - The span to pull attributes from.
   * @param {object} params.transaction - The transaction to finalize.
   * @param {object} params.rule - The transformation rule to use.
   */
  finalizeTransaction({ segment, span, transaction, rule }) {
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
      const rules = this.buildRuleMappings(txTransformation?.url?.mappings)
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
