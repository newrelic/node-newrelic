/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'http-agent' })
const https = require('https')

// poor person's single-instance-objects.  We
// only ever instantiate one of each HTTP-agent
// and just reuse the same object in all the
// requests. This is how node does keep-alive.
let agentKeepAlive = null
let agentProxyWithKeepAlive = null

/**
 * Returns an HTTP agent with keep-alive enabled
 *
 * @param {AgentConfig} config configuration for HTTP agent
 *
 * @returns {object} `https.Agent` instance.
 */
exports.keepAliveAgent = function keepAliveAgent(config) {
  config = config ? config : {}

  // always return the same agent instance, which
  // ensures all requests share the same http
  // connection
  if (agentKeepAlive !== null) {
    return agentKeepAlive
  }

  config.keepAlive = true
  agentKeepAlive = new https.Agent(config)
  return agentKeepAlive
}

/**
 * Returns an HTTP-agent provided by the https-proxy-agent
 * NPM package with configuration suitable for working via
 * the configured newrelic-agent's proxy configuration.
 *
 * Include keep-alive configuration, but ultimately it's up
 * to the proxy server as to how its connection is made
 * with New Relic's servers.
 *
 * @param {AgentConfig} config configuration for proxy agent
 *
 * @returns {object} `https.Agent` instance.
 */
exports.proxyAgent = function proxyAgent(config) {
  if (agentProxyWithKeepAlive !== null) {
    return agentProxyWithKeepAlive
  }
  const proxyUrl = buildProxyUrl(config)

  // Tests may supply 127.0.0.1 as the host, but SNI requires a hostname.
  const servername = config.host
  const proxyOpts = {
    secureEndpoint: config.ssl,
    auth: proxyUrl.auth,
    ca: config?.certificates?.length ? config.certificates : [],
    keepAlive: true,
    servername
  }
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    proxyOpts.rejectUnauthorized = false
  }

  logger.info(`using proxy: ${proxyUrl}`)
  // lazy-load `https-proxy-agent` as it is ESM
  // if required at top it would not allow us to instrument
  // the core `node:http` correctly.
  const { HttpsProxyAgent } = require('https-proxy-agent')
  agentProxyWithKeepAlive = new HttpsProxyAgent(proxyUrl, proxyOpts)
  return agentProxyWithKeepAlive
}

/**
 * Reads the proxy configuration options from an agent configuration
 * instance and returns an appropriate URL to the configured proxy.
 *
 * @param {AgentConfig} config The agent configuration instance to get
 * proxy information from.
 *
 * @returns {string} Proxy URL.
 */
function buildProxyUrl(config) {
  let proxyUrl
  if (config.proxy) {
    proxyUrl = config.proxy
  } else {
    proxyUrl = 'https://'
    let proxyAuth = config.proxy_user
    if (config.proxy_pass !== '') {
      proxyAuth += ':' + config.proxy_pass
      proxyUrl += `${proxyAuth}@`
    }

    proxyUrl += `${config.proxy_host || 'localhost'}:${config.proxy_port || 80}`
  }

  return proxyUrl
}
exports.buildProxyUrl = buildProxyUrl

/**
 * Indicates if the agent has been configured with proxy configuration or not.
 *
 * @param {AgentConfig} config The agent configuration.
 *
 * @returns {boolean} The result of the inspection.
 */
exports.proxySettingsPresent = function proxySettingsPresent(config) {
  return config.proxy !== '' || config.proxy_host !== ''
}
