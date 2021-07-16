'use stric'
const http = require('http')
const methodsLower = http.METHODS.map((method) => method.toLowerCase())
module.exports.METHODS = methodsLower
