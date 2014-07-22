# Node HTTP/HTTPS Forward Proxy Agent

This a Node http agent capable of forward proxying HTTP/HTTPS requests.

It supports the following:
* Connect to a proxy with either HTTP or HTTPS
* Proxying to a remote server using SSL tunneling (via the http CONNECT method)
* Authenticate with a proxy with Basic authentication
* Authenticate with a proxy with NTLM authentication (beta)

The agent inherits directly from the ``http.Agent`` Node object so it benefits from all
the socket handling goodies that come with it.

## Installation

    npm install proxying-agent

## Usage

The following options are supported:

* ``proxy`` - Specifies the proxy url. The supported format is ``http[s]://[auth@]host:port`` where ``auth``
    is the authentication information in the form of ``username:password``. The authentication information can also be
    in the form of a Base64 encoded ``user:password``, e.g. ``http://dXNlcm5hbWU6cGFzc3dvcmQ=@proxy.example.com:8080``
* ``tunnel`` - If ``true`` then the proxy will become a tunnel to the server.
    This should usually be ``true`` only if the target server protocol is ``https``
* ``authType`` - Proxy authentication type. Possible values are ``basic`` and ``ntlm`` (default is ``basic``).
* ``ntlm`` - (beta) applicable only if ``authType`` is ``ntlm``. Supported fields:
    * ``domain`` (required) - the NTLM domain
    * ``workstation`` (optional) - the local machine hostname (os.hostname() is not specified)

### HTTP Server

```javascript
  var proxying = require('proxying-agent');
  var proxyingOptions = {
    proxy: 'http://proxy.example.com:8080'
  };
  var proxyingAgent = new proxying.ProxyingAgent(proxyingOptions);
  var req = http.request({
    host: 'example.com',
    port: 80,
    agent: proxyingAgent
  });
```

### HTTPS Server

```javascript
  var proxying = require('proxying-agent');
  var proxyingOptions = {
    proxy: 'http://proxy.example.com:8080',
    tunnel: true
  };
  var proxyingAgent = new proxying.ProxyingAgent(proxyingOptions);
  var req = https.request({
    host: 'example.com',
    port: 443,
    agent: proxyingAgent
  });
```

### Basic Authentication

```javascript
  var proxying = require('proxying-agent');
  var proxyingOptions = {
    proxy: 'http://username:password@proxy.example.com:8080',
    tunnel: true
  };
  var proxyingAgent = new proxying.ProxyingAgent(proxyingOptions);
  var req = https.request({
    host: 'example.com',
    port: 443,
    agent: proxyingAgent
  });
```

### NTLM Authentication

When authenticating using NTLM it is important to delay sending the request data until the socket is assigned to the request.
Failing to do so will result in the socket being prematurely closed, preventing the NTLM handshake from completing.

```javascript
  var proxying = require('proxying-agent');
  var proxyingOptions = {
    proxy: 'http://username:password@proxy.example.com:8080',
    tunnel: true,
    authType: 'ntlm',
    ntlm: {
      domain: 'MYDOMAIN'
    }
  };
  var proxyingAgent = new proxying.ProxyingAgent(proxyingOptions);
  var req = https.request({
    host: 'example.com',
    port: 443,
    agent: proxyingAgent
  });

  req.on('socket', function(socket) {
    req.write('DATA');
    req.end();
  });
```

## References

* NTLM code was forked from https://github.com/SamDecrock/node-http-ntlm.git
* NTLM Authentication Scheme for HTTP - http://www.innovation.ch/personal/ronald/ntlm.html

## Copyright and License

Copyright 2013-2014 Capriza. Code released under the [MIT license](LICENSE.md)
