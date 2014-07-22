'use strict';

var path         = require('path')
  , parse        = require('url').parse
  , format       = require('url').format
  , https        = require('https')
  , HTTPAgent    = require('yakaa')
  , SSLAgent     = HTTPAgent.SSL
  , ProxyAgent   = require(path.join(__dirname, '..', '..', 'node_vendor', 'proxying-agent')).ProxyingAgent
  , logger       = require(path.join(__dirname, '..', 'logger'))
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
      logger.trace('setting proxy', proxy_url);
    } else {
      // we support basic auth
      var proxy_auth = config.proxy_user;
      if (config.proxy_pass !== '')
        proxy_auth += ':' + config.proxy_pass;

      // only http protocol to proxy
      // if you want https, use the proxy config
      var proxy_url = {
        protocol : 'http',
        hostname : config.proxy_host || 'localhost',
        port     : config.proxy_port,
        auth     : proxy_auth
      };

      logger.trace('setting proxy from proxy_url and proxy_port',
        proxy_url,
        config.proxy_host,
        config.proxy_port,
        config.proxy_user,
        config.proxy_path
      );
    }

    var tunnel = config.ssl;
    var opts   = {
      proxy  : format(proxy_url),
      tunnel : tunnel,
    };

    // merge user certificates with built-in certs
    var certs = config.certificates;
    if (config.certificates) {
      certs = certificates.concat(certs);
    }

    logger.info('using proxy with options', opts);

    var proxy = new ProxyAgent(opts);
    if (proxy_url.protocol === 'https:') {
      // if we want to connect to the proxy with SSL,
      // we need to specify our own https agent
      //
      // if we need a custom ssl certificate, it should be
      // passed in via the certificates config setting
      proxy.agent = https.Agent;
      proxy.options.agent = new https.Agent({
        // if you want to debug SSL and proxies,
        // you'll want to enable the following two methods
        //
        // rejectUnauthorized : false,
        // secureProtocol     : 'SSLv3_method',
        //
        // You can provide your own SSL cert, and decrypt it with wireshark
        ca: certs,
      });
    }

    // if we're tunneling, upgrade the connection using the SSL
    // certificates defined above
    if (tunnel) proxy.options.ca = certs;

    return proxy;
  },
};
