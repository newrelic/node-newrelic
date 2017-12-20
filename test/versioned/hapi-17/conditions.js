'use strict'

var semver = require('semver')

module.exports = {
  // hapi 17.x works on Node 8.9 and higher
  skip: semver.satisfies(process.version, '<8.9')
}
