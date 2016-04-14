'use strict'

var parse = require('url').parse
var extend = require('util')._extend
var HTTPAgent = require('yakaa')
var SSLAgent = HTTPAgent.SSL
var ProxyAgent = require('https-proxy-agent')
var logger = require('../logger').child({component: 'http-agent'})
var certificates = require('./ssl/certificates.js')

var CIPHERS = "ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:" +
              "ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:" +
              "DHE-RSA-AES128-GCM-SHA256:DHE-DSS-AES128-GCM-SHA256:kEDH+AESGCM:" +
              "ECDHE-RSA-AES128-SHA256:ECDHE-ECDSA-AES128-SHA256:" +
              "ECDHE-RSA-AES128-SHA:ECDHE-ECDSA-AES128-SHA:" +
              "ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES256-SHA384:" +
              "ECDHE-RSA-AES256-SHA:ECDHE-ECDSA-AES256-SHA:" +
              "DHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA256:" +
              "DHE-RSA-AES256-SHA256:DHE-DSS-AES256-SHA:DHE-RSA-AES256-SHA:" +
              "AES128-GCM-SHA256:AES256-GCM-SHA384:AES128:AES256:HIGH:" +
              "!aNULL:!eNULL:!EXPORT:!DES:!3DES:!MD5:!PSK:!RC4"

var baseConfig = {
  keepAlive: true,
  keepAliveTimeoutMsecs: 500,
  maxSockets: 1 // requests are serialized
}

var httpsConfig = extend({
  rejectUnauthorized: true,
  ciphers: CIPHERS
}, baseConfig)

exports.httpAgent = new HTTPAgent(baseConfig)

exports.httpsAgent = new SSLAgent(httpsConfig)

exports.proxyAgent = function proxyAgent(config) {
  var opts = proxyOptions(config)
  var proxy_url = opts.proxy_url

  var proxy_opts = {
    host: proxy_url.host,
    port: proxy_url.port,
    protocol: proxy_url.protocol,
    secureEndpoint: config.ssl,
    auth: proxy_url.auth,
    ca: opts.certificates
  }

  logger.info({
    host: proxy_opts.host,
    port: proxy_opts.port,
    auth: !!proxy_opts.auth,
    protocol: proxy_url.protocol
  }, 'using proxy')

  var proxy = new ProxyAgent(proxy_opts)

  return proxy
}

function proxyOptions(config) {
  if (config.proxy) {
    var parsed_url = parse(config.proxy)

    var proxy_url = {
      protocol: parsed_url.protocol || 'http:',
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
      protocol: 'http:',
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
