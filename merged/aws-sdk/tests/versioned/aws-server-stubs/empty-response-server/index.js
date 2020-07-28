'use strict'

const http = require('http')

function createEmptyResponseServer() {
  const server = http.createServer(function(req, res) {
    if (req.method === 'POST') {
      handlePost(req, res)
      return
    }

    res.statusCode = 500
    res.end()
  })

  return server
}

function handlePost(req, res) {
  let body = ''

  req.on('data', chunk => {
      body += chunk.toString()
  })

  req.on('end', () => {
    // we have to read the body for things to work,
    // so might as well log it out for troubleshooting.
    // eslint-disable-next-line no-console
    console.log(body)

    // currently, some tests do not rely on real responses back.
    // it is enough to return something valid to the client.
    res.end()
  })
}

module.exports = createEmptyResponseServer
