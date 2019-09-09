'use strict'

const tap = require('tap')
const read = require('fs').readFileSync
const join = require('path').join
const https = require('https')
const RemoteMethod = require('../../lib/collector/remote-method')

tap.test("RemoteMethod makes two requests with one connection", (t) => {
  t.ok(true, "Setup Test")

  // create a basic https server using our standard test certs
  let opts = {
    port: 8765,
    key: read(join(__dirname, '../lib/test-key.key')),
    cert: read(join(__dirname, '../lib/self-signed-test-certificate.crt'))
  }
  const server = https.createServer(opts, function(req, res) {
    res.write("hello ssl")
    res.end()
  })
  server.keepAliveTimeout = 2000

  // close server when test ends
  t.tearDown(() => {
    server.close()
  })

  // start the server, and then start making requests
  server.listen(8765, function() {
    // once we start a server, use a RemoteMethod
    // object to make a request
    const method = createRemoteMethod()
    method.invoke({}, [], function(err, res) {
      t.ok(200 === res.status, "First request success")

      // once first request is done, create a second request
      const method2 = createRemoteMethod()
      method2.invoke({}, [], function(err2, res2) {
        t.ok(200 === res2.status, "Second request success")
        // end the test
        t.end()
      })
    })
  })


  let connections = 0

  // setup a connection listener for the server
  // if we see more than one, keep alive isn't
  // working.
  server.on('connection', function() {
    connections++
    if (2 === connections) {
      t.fail("RemoteMethod made second connection despite keep-alive.")
    }
  })
})

function createRemoteMethod() {
  const config = {
    host: 'ssl.lvh.me',
    port: 8765,
    ssl: true,
    max_payload_size_in_bytes: 1000000
  }

  config.certificates = [
    read(join(__dirname, '../lib/ca-certificate.crt'), 'utf8')
  ]

  const method = new RemoteMethod('fake', config)
  return method
}
