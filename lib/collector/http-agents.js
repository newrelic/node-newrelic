'use strict'

var parse = require('url').parse
var ProxyAgent = require('https-proxy-agent')
var logger = require('../logger').child({component: 'http-agent'})
var certificates = require('./ssl/certificates.js')

const https = require('https')

// poor person's single-instance-objects.  We
// only ever instantiate one of each HTTP-agent
// and just reuse the same object in all the
// requests. This is how node does keep-alive.
let agentKeepAlive = null
let agentProxyWithKeepAlive = null

/**
 * Returns an HTTP agent with keep-alive enabled
 */
exports.keepAliveAgent = function keepAliveAgent(config) {
  config = config ? config : {}

  // always return the same agent instance, which
  // ensures all requests share the same http
  // connection
  if (null !== agentKeepAlive) {
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
 * Include keep-alive configuration, but ultimatly its up
 * to the proxy server as to how its connection is made
 * with New Relic's servers.
 */
exports.proxyAgent = function proxyAgent(config) {
  if (null !== agentProxyWithKeepAlive) {
    return agentProxyWithKeepAlive
  }
  var opts = proxyOptions(config)
  var proxy_url = opts.proxy_url

  var proxy_opts = {
    host: proxy_url.host,
    port: proxy_url.port,
    protocol: proxy_url.protocol,
    secureEndpoint: config.ssl,
    auth: proxy_url.auth,
    ca: opts.certificates,
    keepAlive: true
  }

  logger.info({
    host: proxy_opts.host,
    port: proxy_opts.port,
    auth: !!proxy_opts.auth,
    protocol: proxy_url.protocol
  }, 'using proxy')

  agentProxyWithKeepAlive = new ProxyAgent(proxy_opts)
  return agentProxyWithKeepAlive
}

function proxyOptions(config) {
  if (config.proxy) {
    var parsed_url = parse(config.proxy)

    var proxy_url = {
      protocol: parsed_url.protocol || 'https:',
      host: parsed_url.hostname,
      port: parsed_url.port || 80,
      auth: parsed_url.auth
    }
  } else {
    var proxy_auth = config.proxy_user
    if (config.proxy_pass !== '') {
      proxy_auth += ':' + config.proxy_pass
    }

    // Unless a proxy config is provided, default to HTTP.
    proxy_url = {
      protocol: 'https:',
      host: config.proxy_host || 'localhost',
      port: config.proxy_port || 80,
      auth: proxy_auth
    }
  }

  var opts = {
    proxy_url: proxy_url
  }

  // merge user certificates with built-in certs

  if (config.certificates && config.certificates.length > 0) {
    logger.info(
      'Using a proxy with a special cert. This enables our cert bundle which, combined ' +
      'with some versions of node, exacerbates a leak in node core TLS.'
    )
    opts.certificates = config.certificates.concat(certificates)
  }

  return opts
}
