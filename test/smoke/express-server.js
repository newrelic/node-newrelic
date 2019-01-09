'use strict'

require('../../index') // same as require('newrelic')
const express = require('express')

const app = express()

app.get('/', (req, res) => {
  req.resume()
  res.end('hello world!')
})

const server = app.listen(0, () => {
  process.send(server.address().port)
})
