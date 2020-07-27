'use strict'

const http = require('http')

function createDynamoDbServer() {
  const server = http.createServer(function(req, res) {
    if (req.method === 'POST') {
      handleDdbPost(req, res)
      return
    }

    res.statusCode = 500
    res.end()
  })

  return server
}

function handleDdbPost(req, res) {
  let body = ''

  req.on('data', chunk => {
      body += chunk.toString()
  })

  req.on('end', () => {
    // we have to read the body for things to work,
    // so might as well log it out for troubleshooting.
    // eslint-disable-next-line no-console
    console.log(body)

    // currently, the tests do not rely on real responses back.
    // it is enough to return something valid to the client
    res.end()
  })
}

module.exports = createDynamoDbServer
