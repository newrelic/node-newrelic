'use strict'

var url = require('url')

/**
 * Utility functions for enforcing New Relic naming conditions on URLs,
 * and extracting and setting parameters on traces / web trace segments.
 */
module.exports = {
  /**
   * This was handed down from the prototype as the canonical list of status
   * codes that short-circuit naming and normalization. The agent can be
   * configured to mark HTTP status codes as not being errors.
   *
   * @param {Config} config The configuration containing the error list.
   * @param {string} code   The HTTP status code to check.
   *
   * @returns {bool} Whether the status code should be ignored.
   */
  isError: function isError(config, code) {
    return code >= 400 && !isIgnoredStatusCodeForErrors(config, code)
  },

  /**
   * Returns true if the status code is an HTTP error, and it is configured to be ignored.
   *
   * @param {Config} config The configuration containing the error list.
   * @param {string} code   The HTTP status code to check.
   *
   * @returns {bool} Whether the status code should be ignored.
   */
  isIgnoredError: function isIgnoredError(config, code) {
    return code >= 400 && isIgnoredStatusCodeForErrors(config, code)
  },

  /**
   * Get back the pieces of the URL that New Relic cares about. Apply these
   * restrictions, in order:
   *
   * 1. Ensure that after parsing the URL, there's at least '/'
   * 2. Strip off session trackers after ';' (a New Relic convention)
   * 3. Remove trailing slash.
   *
   * @param {string} requestURL The URL fragment to be scrubbed.
   * @return {string} The cleaned URL.
   */
  scrub: function scrub(requestURL) {
    if (typeof requestURL === 'string') {
      requestURL = url.parse(requestURL)
    }

    var path = requestURL.pathname

    if (path) {
      path = path.split(';')[0]

      if (path !== '/' && path.charAt(path.length - 1) === '/') {
        path = path.substring(0, path.length - 1)
      }
    } else {
      path = '/'
    }

    return path
  },

  /**
   * Extract query parameters, dealing with bare parameters and parameters with
   * no value as appropriate:
   *
   * 'var1&var2=value' is not necessarily the same as 'var1=&var2=value'
   *
   * In my world, one is an assertion of presence, and the other is an empty
   * variable. Some web frameworks behave this way as well, so don't lose
   * information.
   *
   * @param {string} requestURL The URL to be parsed.
   * @returns {object} The parameters parsed from the request
   */
  parseParameters: function parseParameters(requestURL) {
    var parsed = requestURL

    if (typeof requestURL === 'string') {
      parsed = url.parse(requestURL, true)
    }

    var parameters = {}

    if (parsed.query) {
      var keys = Object.keys(parsed.query)

      for (var i = 0, l = keys.length; i < l; ++i) {
        var key = keys[i]
        if (parsed.query[key] === '' && parsed.path.indexOf(key + '=') === -1) {
          parameters[key] = true
        } else {
          parameters[key] = parsed.query[key]
        }
      }
    }

    return parameters
  },

  /**
   * Copy a set of request parameters from one object to another, following
   * a few important rules:
   *
   * 1. Do not copy a parameter if it's in config.ignored_params.
   * 2. Do not overwrite any existing parameters in destination, including
   *    parameters set to null or undefined.
   *
   * @param {Config} config      Configuration, where `ignored_params` is
   *                             guaranteed to be an Array.
   * @param {object} source      Parameters to be copied (not changed).
   * @param {object} destination Dictionary to which parameters are copied
   *                             (mutated in place).
   */
  copyParameters: function copyParameters(config, source, destination) {
    if (!(config && config.capture_params && source && destination)) return

    var keys = Object.keys(source)
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
      if (config.ignored_params.indexOf(key) === -1 && !(key in destination)) {
        destination[key] = source[key]
      }
    }
  },
  /**
   * Copy a set of request parameters from one object to another.
   * Existing attributes on the `destination` will be overwritten.
   * Unlike `copyParameters`, this function will operate when
   * `capture_params` is not enabled.
   *
   * @param {Config} config      Configuration, where `ignored_params` is
   *                             guaranteed to be an Array.
   * @param {object} source      Parameters to be copied (not changed).
   * @param {object} destination Dictionary to which parameters are copied
   *                             (mutated in place).
   */
  overwriteParameters: function overwriteParameters(config, source, destination) {
    if (!(config && source && destination)) return

    var keys = Object.keys(source)
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
      if (config.ignored_params.indexOf(key) === -1) {
        destination[key] = source[key]
      }
    }
  }
}

function isIgnoredStatusCodeForErrors(config, code) {
  var codes = []
  if (config &&
      config.error_collector &&
      config.error_collector.ignore_status_codes) {
    codes = config.error_collector.ignore_status_codes
  }
  return codes.indexOf(parseInt(code, 10)) >= 0
}

