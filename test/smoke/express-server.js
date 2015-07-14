require('../../index.js') // same as require('newrelic')
var express = require('express')

var app = express()

app.get('/', function (req, res) {
  req.resume()
  res.end('hello world!')
})

var server = app.listen(0, function () {
  process.send(server.address().port)
})
