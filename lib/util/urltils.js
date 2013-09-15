'use strict';

var url = require('url');

/**
 * Utility functions for enforcing New Relic naming conditions on URLs,
 * and extracting and setting parameters on traces / web trace segments.
 */
module.exports = {
  /**
   * This was handed down from the prototype as the canonical list of
   * status codes that short-circuit naming and normalization.
   *
   * @param {number} statusCode HTTP status code to test
   */
  isError : function isError(statusCode) {
    return statusCode >= 400;
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
  scrub : function scrub(requestURL) {
    var path = url.parse(requestURL).pathname;

    if (path) {
      path = path.split(';')[0];

      if (path !== '/' && path.charAt(path.length - 1) === '/') {
        path = path.substring(0, path.length - 1);
      }
    }
    else {
      path = '/';
    }

    return path;
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
  parseParameters : function parseParameters(requestURL) {
    var parsed     = url.parse(requestURL, true)
      , parameters = {}
      ;

    if (parsed.search !== '') {
      Object.keys(parsed.query).forEach(function (key) {
        if (parsed.query[key] === '' && parsed.path.indexOf(key + '=') < 0) {
          parameters[key] = true;
        }
        else {
          parameters[key] = parsed.query[key];
        }
      });
    }

    return parameters;
  }
};
