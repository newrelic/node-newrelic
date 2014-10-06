'use strict'

var path         = require('path')
  , parse        = require('url').parse
  , format       = require('url').format
  , https        = require('https')
  , HTTPAgent    = require('yakaa')
  , SSLAgent     = HTTPAgent.SSL
  , ProxyAgent   = require('proxying-agent').ProxyingAgent
  , logger       = require('../logger')
  , certificates = require('./ssl/certificates.js')
  

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
  proxyAgent: function (config) {
    var proxy_url
    if (config.proxy) {
      proxy_url = parse(config.proxy)
    } else {
      // we support basic auth
      var proxy_auth = config.proxy_user
      if (config.proxy_pass !== '')
        proxy_auth += ':' + config.proxy_pass

      // only http protocol to proxy
      // if you want https, use the proxy config
      proxy_url = {
        protocol : 'http',
        hostname : config.proxy_host || 'localhost',
        port     : config.proxy_port,
        auth     : proxy_auth
      }
    }

    // merge user certificates with built-in certs
    var certs = config.certificates
    if (config.certificates) {
      certs = certificates.concat(certs)
    }

    var tunnel = config.ssl
    var opts   = {
      proxy      : format(proxy_url),
      tunnel     : tunnel,
      tlsOptions : {ca: certs},
    }

    logger.info({
      host: proxy_url.hostname || 'localhost',
      port: proxy_url.port || 80,
      auth: !!proxy_url.auth,
      protocol: proxy_url.protocol || 'http',
    }, 'using proxy')

    var proxy = new ProxyAgent(opts)
    if (proxy_url.protocol === 'https:') {
      // if we want to connect to the proxy with SSL,
      // we need to specify our own https agent
      //
      // if we need a custom ssl certificate, it should be
      // passed in via the certificates config setting
      proxy.agent = https.Agent
      proxy.options.agent = new https.Agent({
        // if you want to debug SSL and proxies,
        // you'll want to enable the following two methods
        //
        // rejectUnauthorized : false,
        // secureProtocol     : 'SSLv3_method',
        //
        // You can provide your own SSL cert, and decrypt it with wireshark
        ca: certs,
      })
    }

    return proxy
  },
}
