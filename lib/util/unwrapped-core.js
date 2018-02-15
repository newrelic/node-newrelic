'use strict'

var copy = require('./copy')
var fs = require('fs')

exports.fs = copy.shallow(fs)
