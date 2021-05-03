'use strict'
const sinon = require('sinon')

module.exports = (sandbox = sinon) => ({
  trace: sandbox.stub(),
  info: sandbox.stub(),
  debug: sandbox.stub(),
  warn: sandbox.stub(),
  error: sandbox.stub()
})
