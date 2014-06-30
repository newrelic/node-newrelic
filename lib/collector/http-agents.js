'use strict';

var path         = require('path')
  , parse        = require('url').parse
  , format       = require('url').format
  , HTTPAgent    = require('yakaa')
  , ProxyAgent   = require('proxying-agent').ProxyingAgent
  , SSLAgent     = HTTPAgent.SSL
  , certificates = require(path.join(__dirname, 'ssl', 'certificates.js'))
  ;

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
              "!aNULL:!eNULL:!EXPORT:!DES:!3DES:!MD5:!PSK";

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
    if (config.proxy) {
      var proxy_url = parse(config.proxy);
    } else {
      var proxy_url = format({
        protocol : 'http',
        hostname : config.proxy_host || 'localhost',
        port     : config.proxy_port,
      });
    }

    var tunnel = config.ssl;
    var opts   = {
      proxy  : proxy_url,
      tunnel : tunnel,
    };
    return new ProxyAgent(opts);
  },
};
