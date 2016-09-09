var semver = require('semver')

module.exports = function shouldSkip() {
  return semver.satisfies(process.version, '<0.10')
}
