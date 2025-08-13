/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const url = require('url')
const logger = require('../logger').child({ component: 'urltils' })

const LOCALHOST_NAMES = {
  localhost: true,
  '127.0.0.1': true,
  '0.0.0.0': true,
  '0:0:0:0:0:0:0:1': true,
  '::1': true,
  '0:0:0:0:0:0:0:0': true,
  '::': true
}

/**
 * Utility functions for enforcing New Relic naming conditions on URLs,
 * and extracting and setting parameters on traces / web trace segments.
 */
module.exports = {
  /**
   * Dictionary whose keys are all synonyms for localhost.
   *
   * @constant
   */
  LOCALHOST_NAMES,

  /**
   * Checks if the given name is in the dictionary of localhost names.
   *
   * @param {string} host - The hostname to lookup.
   * @returns {boolean} - True if the given hostname is a synonym for localhost.
   */
  isLocalhost: function isLocahost(host) {
    return LOCALHOST_NAMES[host] != null
  },

  /**
   * This was handed down from the prototype as the canonical list of status
   * codes that short-circuit naming and normalization. The agent can be
   * configured to mark HTTP status codes as not being errors.
   *
   * @param {Config} config The configuration containing the error list.
   * @param {string} code   The HTTP status code to check.
   * @returns {boolean} Whether the status code should be ignored.
   */
  isError: function isError(config, code) {
    return code >= 400 && !isIgnoredStatusCodeForErrors(config, code)
  },

  /**
   * Returns true if the status code is an HTTP error, and it is configured to be ignored.
   *
   * @param {Config} config The configuration containing the error list.
   * @param {string} code   The HTTP status code to check.
   * @returns {boolean} Whether the status code should be ignored.
   */
  isIgnoredError: function isIgnoredError(config, code) {
    return code >= 400 && isIgnoredStatusCodeForErrors(config, code)
  },

  /**
   * Returns true if the status code is configured to be expected
   *
   * @param {Config} config The configuration containing the error list.
   * @param {string} code   The HTTP status code to check.
   * @returns {boolean} Whether the status code is expected.
   */
  isExpectedError: function isExpectedError(config, code) {
    return isExpectedStatusCodeForErrors(config, code)
  },

  /**
   * Get back the pieces of the URL that New Relic cares about. Apply these
   * restrictions, in order:
   *
   * 1. Ensure that after parsing the URL, there's at least '/'
   * 2. Strip off session trackers after ';' (a New Relic convention)
   * 3. Remove trailing slash.
   *
   * @param {string|url.URL} requestURL The URL fragment to be scrubbed.
   * @returns {string} The cleaned URL.
   */
  scrub: function scrub(requestURL) {
    // partialNameFromUri can currently pass a string
    if (typeof requestURL === 'string') {
      requestURL = url.parse(requestURL)
    }

    let path = requestURL.pathname

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
   * @param {string|url.URL} requestURL The URL to be parsed.
   * @returns {object} The parameters parsed from the request
   */
  parseParameters: function parseParameters(requestURL) {
    let parsed = requestURL
    const parameters = Object.create(null)

    // TODO: remove raw param
    function addParam(key, value, raw) {
      if (value === '' && urlPath.indexOf(key + '=') === -1) {
        parameters[key] = true
      } else {
        parameters[key] = value
      }
    }

    // TODO: will this ever be a string?
    if (typeof requestURL === 'string') {
      parsed = new URL(requestURL, `http://${requestURL}`)
    }

    const urlPath = parsed.href || parsed.path

    // TODO: remove after we remove all of url.parse even in tests
    // since there is no parsed.query
    if (parsed.query) {
      for (const key of Object.keys(parsed.query)) {
        addParam(key, parsed.query[key], parsed.path || '')
      }
    }

    // NOTE: parsed.searchParams doesn't include empty value so a key with value "="
    // isn't included so it doesn't hit line 132 and instead hits 129 unless we check
    // for existance of this value in urlPath instead of pathname
    if (parsed.searchParams) {
      for (const [key, value] of parsed.searchParams) {
        addParam(key, value, parsed.pathname || '')
      }
    }

    return parameters
  },

  /**
   * Performs the logic of `urltils.scrub` and `urltils.parseParameters` with
   * only a single parse of the given URL.
   *
   * @param {url.URL} requestURL - The URL object to scrub and extra parameters from.
   * @returns {object} An object containing the scrubbed url at `.path` and the
   *  parsed parameters at `.parameters`.
   */
  scrubAndParseParameters: function scrubAndParseParameters(requestURL) {
    return {
      protocol: requestURL.protocol,
      path: this.scrub(requestURL),
      parameters: this.parseParameters(requestURL)
    }
  },

  /**
   * Obfuscates path parameters with regex from config
   *
   * @param {Config} config The configuration containing the regex
   * @param {string} path The path to be obfuscated
   * @returns {string} The obfuscated path or the original path
   */
  obfuscatePath: function obfuscatePath(config, path) {
    const { enabled, regex } = config.url_obfuscation
    if (typeof path !== 'string' || !enabled || !regex) {
      return path
    }

    const { pattern, flags = '', replacement = '' } = regex
    try {
      const regexPattern = new RegExp(pattern, flags)
      return path.replace(regexPattern, replacement)
    } catch {
      logger.warn('Invalid regular expression for url_obfuscation.regex.pattern', pattern)
      return path
    }
  },

  /**
   * Copy a set of request parameters from one object to another,
   * but do not overwrite any existing parameters in destination,
   * including parameters set to null or undefined.
   *
   * @param {object} source      Parameters to be copied (not changed).
   * @param {object} destination Dictionary to which parameters are copied
   *                             (mutated in place).
   */
  copyParameters: function copyParameters(source, destination) {
    if (source && destination) {
      const keys = Object.keys(source)
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        if (!(key in destination)) {
          destination[key] = source[key]
        }
      }
    }
  },

  /**
   * Copy a set of request parameters from one object to another.
   * Existing attributes on the `destination` will be overwritten.
   *
   * @param {object} source      Parameters to be copied (not changed).
   * @param {object} destination Dictionary to which parameters are copied
   *                             (mutated in place).
   */
  overwriteParameters: function overwriteParameters(source, destination) {
    const keys = Object.keys(source)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      destination[key] = source[key]
    }
  }
}

function isIgnoredStatusCodeForErrors(config, code) {
  let codes = []
  if (config && config.error_collector && config.error_collector.ignore_status_codes) {
    codes = config.error_collector.ignore_status_codes
  }
  return codes.indexOf(parseInt(code, 10)) >= 0
}

function isExpectedStatusCodeForErrors(config, code) {
  let codes = []
  if (config && config.error_collector && config.error_collector.expected_status_codes) {
    codes = config.error_collector.expected_status_codes
  }
  return codes.indexOf(parseInt(code, 10)) >= 0
}
