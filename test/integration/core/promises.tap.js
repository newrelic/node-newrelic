'use strict'

if (!global.Promise) {
  console.error('Promise tests cant run without native Promises')
  return
}

require('./promises.js')()
