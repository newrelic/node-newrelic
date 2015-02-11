'use strict'

var path         = require('path')
var parse        = require('url').parse
var format       = require('url').format
var https        = require('https')
var HTTPAgent    = require('yakaa')
var SSLAgent     = HTTPAgent.SSL
var ProxyAgent   = require('https-proxy-agent')
var logger       = require('../logger')
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
              "AES128-GCM-SHA256:AES256-GCM-SHA384:ECDHE-RSA-RC4-SHA:" +
              "ECDHE-ECDSA-RC4-SHA:AES128:AES256:RC4-SHA:HIGH:" +
              "!aNULL:!eNULL:!EXPORT:!DES:!3DES:!MD5:!PSK"

module.exports = {
  http  : new HTTPAgent({
    keepAlive             : true,
    keepAliveTimeoutMsecs : 500,
    maxSockets            : 1, // requests are serialized
  }),
  https : new SSLAgent({
    keepAlive             : true,
    keepAliveTimeoutMsecs : 500,
    rejectUnauthorized    : true,
    ca                    : certificates,
    ciphers               : CIPHERS,
    maxSockets            : 1, // minimize TLS socket creation overhead
  }),
  proxyOptions: function (config) {
    if (config.proxy) {
      var parsed_url = parse(config.proxy)

      var proxy_url = {
        protocol : parsed_url.protocol || 'http:',
        host     : parsed_url.hostname,
        port     : parsed_url.port || 80,
        auth     : parsed_url.auth
      }
    } else {
      var proxy_auth = config.proxy_user
      if (config.proxy_pass !== '') {
        proxy_auth += ':' + config.proxy_pass
      }

      // Unless a proxy config is provided, default to HTTP.
      proxy_url = {
        protocol : 'http:',
        host     : config.proxy_host || 'localhost',
        port     : config.proxy_port || 80,
        auth     : proxy_auth
      }
    }

    // merge user certificates with built-in certs
    var certs = certificates
    if (config.certificates) {
      certs = config.certificates.concat(certs)
    }

    var opts   = {
      proxy_url    : proxy_url,
      certificates : certs
    }

    return opts
  },
  proxyAgent: function (config) {
    var opts = this.proxyOptions(config)
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
  },
}
