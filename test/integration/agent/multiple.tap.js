'use strict'

var assert = require('chai').assert

process.env.NEW_RELIC_ENABLED = false

var path = require.resolve('../../../index.js')
var first = require(path)

delete require.cache[path]

var second = require(path)

assert.equal(first, second)
