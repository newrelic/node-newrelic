/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../../logger').child({ component: 'http2' })

// const { RecorderSpec } = require('../../../lib/shim/specs')
const recordExternal = require('../../../lib/metrics/recorders/http_external')
const NAMES = require('../../metrics/names')
const { URL } = require('node:url')
// const synthetics = require('../../synthetics')
const symbols = require('../../symbols')
const { instrumentRequestEmit } = require('./http-outbound')
const urltils = require('../../util/urltils')
const { ClassWrapSpec } = require('../../../lib/shim/specs')
const http2Lib = require('http2')

module.exports = initialize

function initialize(agent, http2, moduleName, shim) {
  shim.wrap(http2, ['connect'], wrapConnect)

  function wrapConnect(shim, fn) {
    return function wrappedConnect(...args) {
      const context = this
      // URL is args[0], a string.

      // http-outbound doesn't work with http2; arguments are all different,
      // and headers can only be used in a session .request(), which is the
      // return value of http2.connect()
      return instrumentOutboundHttp2Connect(agent, args, function makeRequest(args) {
        return fn.apply(context, args)
      })
    }
  }
}

/**
 * Instruments an outbound HTTP request.
 *
 * @param {Agent} agent instantiation of lib/agent.js
 * @param {object} opts HTTP2 request options
 * @param {string} opts.authority URL to which the request is made
 * @param {object} [opts.options] Settings for the HTTP2 session
 * @param {function} [opts.listener] One-time listener for the .connect event
 * @param {Function} makeRequest function for issuing actual HTTP request
 * @returns {object} The instrumented outbound HTTP request.
 */
function instrumentOutboundHttp2Connect(agent, opts, makeRequest) {
  const urlObj = new URL(opts[0])

  const { host, hostname, port } = urlObj

  if (!hostname || port < 1) {
    logger.warn('Invalid host name (%s) or port (%s) for outbound request.', hostname, port)
    return makeRequest(opts)
  }

  const name = NAMES.EXTERNAL.PREFIX + host
  // name should be External/127.0.0.1:59802/model/name-of-model/invoke
  // model, name of model, and command are all from the path

  const parent = agent.tracer.getSegment()
  if (parent && parent.opaque) {
    logger.trace(
      'Not capturing data for outbound request (%s) because parent segment opaque (%s)',
      name,
      parent.name
    )

    return makeRequest(opts)
  }

  const argArray = { agent, opts, makeRequest, host, port, hostname }

  return agent.tracer.addSegment(
    name,
    recordExternal(host, 'http2'),
    parent,
    false,
    instrumentHttp2Connect.bind(null, argArray)
  )
}

function instrumentHttp2Connect(
  { agent, opts, makeRequest, host, port, hostname },
  segment,
  transaction
) {
  // headers are only available on http2session.request() calls, so handle those separately

  const request = applyHttp2Segment({
    opts,
    makeRequest,
    hostname,
    host,
    port,
    segment,
    config: agent.config
  })

  instrumentRequestEmit(agent, host, segment, request)

  return request
}

function applyHttp2Segment({ opts, makeRequest, host, port, hostname, segment, config }) {
  segment.start()
  const request = makeRequest(opts)
  const url = new URL(opts[0])
  const parsed = urltils.scrubAndParseParameters(opts.path)
  parsed.path = urltils.obfuscatePath(config, parsed.path)
  const proto = url.protocol || opts.protocol || 'http:'
  segment.name += parsed.path /// TODO: ensure that path is set in opts, so is appended to name here
  segment.captureExternalAttributes({
    protocol: proto,
    hostname,
    host,
    method: opts.method,
    port,
    path: parsed.path,
    queryParams: parsed.parameters
  })
  request[symbols.segment] = segment
  return request
}
