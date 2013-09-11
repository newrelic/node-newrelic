'use strict';

var path  = require('path')
  , url   = require('url')
  , util  = require('util')
  , NAMES = require(path.join(__dirname, '..', 'metrics', 'names.js'))
  ;

/**
 * This was handed down from the prototype as the canonical list of
 * status codes that short-circuit naming and normalization.
 */
function isError(statusCode) {
  // 414: Request-URI Too Long
  return statusCode === 414 || (400 <= statusCode && statusCode < 405);
}

/**
 * Utility functions for enforcing New Relic naming conditions on URLs,
 * and extracting and setting parameters on traces / web trace segments.
 */
var web = module.exports = {
  /**
   * Get back the pieces of the URL that New Relic cares about. Apply these
   * restrictions, in order:
   *
   * 1. Ensure that after parsing the URL, there's at least '/'
   * 2. Strip off session trackers after ';'
   * 3. Remove trailing slash.
   *
   * @param {string} requestURL The URL fragment to be scrubbed.
   * @return {string} The cleaned URL.
   */
  scrubURL : function scrubURL(requestURL) {
    var path = url.parse(requestURL, true).pathname;

    if (path) {
      // MGI: discard after semicolon to ditch session tracking
      path = path.split(';')[0];
    }
    else {
      path = '/';
    }

    if (path !== '/' && path.charAt(path.length - 1) === '/') {
      path = path.substring(0, path.length - 1);
    }

    return path;
  },

  /**
   * Copy the query parameters from the request URL onto the web trace segment
   * and the trace overall. Traces don't have parameters by default, so create
   * them if necessary. Don't just assign the segment's parameters to the trace,
   * because the segment parameters may have additional metadata, e.g.
   * nr_exclusive_duration_millis.
   *
   * Works entirely via side effects.
   *
   * @param {string} requestURL The URL to be parsed.
   *
   * @returns {object} The parameters parsed from the request
   */
  getParametersFromURL : function getParametersFromURL(requestURL) {
    var parsed = url.parse(requestURL, true);

    var parameters = {};
    if (parsed.search !== '') {
      Object.keys(parsed.query).forEach(function (key) {
        /* 'var1&var2=value' is not necessarily the same as 'var1=&var2=value'
         *
         * In my world, one is an assertion of presence, and the other is
         * an empty variable. Some web frameworks behave this way as well,
         * so don't lose information.
         *
         * TODO: figure out if this confuses everyone and remove if so.
         */
        if (parsed.query[key] === '' && parsed.path.indexOf(key + '=') < 0) {
          parameters[key] = true;
        }
        else {
          parameters[key] = parsed.query[key];
        }
      });
    }

    return parameters;
  },

  /**
   * Name the segment and trace after applying normalization rules, which will
   * optionally mark the transaction as ignored. Should run as late in the
   * transaction's lifetime as possible.
   *
   * If the transaction is ignored, don't bother with the other stuff to save
   * resources.
   *
   * Works entirely via side effects.
   *
   * @param {TraceSegment} segment    The web segment containing the trace and
   *                                  metric normalizer.
   * @param {string}       requestURL The URL to use for normalization.
   * @param {string}       statusCode The HTTP status code set by the transaction.
   */
  normalizeAndName : function normalizeAndName(segment, requestURL, statusCode) {
    var path        = web.scrubURL(requestURL)
      , transaction = segment.trace.transaction
      , partialName = web.name(transaction, path, statusCode)
      ;

    if (!transaction.ignore) {
      var scope  = NAMES.WEB + '/' + partialName
        , params = web.getParametersFromURL(requestURL)
        ;

      // transaction name and web trace segment name must match
      transaction.setWeb(path, scope, statusCode);
      segment.name = scope;

      // partialName is used to name apdex metrics when recording
      segment.partialName = partialName;

      // don't replace any existing segment or trace parameters
      util._extend(segment.parameters, params);
      util._extend(segment.trace.parameters, params);
    }
  },

  /**
   * A transaction can either be named after its error code, the exported
   * API naming functions, or the normalizer. See web.normalize for side
   * effects.
   *
   * @param {Transaction} transaction The transaction to be named.
   * @param {string}      path        The path from the request URL.
   * @param {number}      statusCode  The HTTP status code for the request.
   *
   * @returns {string} The partial name of the transaction.
   */
  name : function name(transaction, path, statusCode) {
    // we've got an error metric
    if (isError(statusCode)) return NAMES.STATUS + statusCode;

    // the API has been used to set the scope explicitly
    if (transaction.scope) return transaction.scope;

    // normalize the URL
    return web.normalize(transaction, path);
  },

  /**
   * Normalization is the last chance the agent has for preventing metric
   * grouping issues. Apply the rules, and either mark the transaction as
   * ignored (via setting the ignored flag directly on the transaction, a
   * side effect) or return the normalized name or its non-normalized
   * value.
   *
   * NOTE: Soon this will enforce backstopping of all non-normalized paths
   * to '*', but that's only going to be applied once the rest of the metric
   * grouping tools have been added.
   *
   * @param {Transaction} transaction The transaction to be named.
   * @param {string}      path        The path from the request URL.
   *
   * @returns (string) The path, with a prefix indicating whether it's
   *                   been normalized.
   */
  normalize : function normalize(transaction, path) {
    var normalizer = transaction.agent.normalizer
      , name       = normalizer.normalize(path)
      ;

    // normalization rules tell us to ignore certain paths
    if (name.ignore) {
      transaction.ignore = true;
      return '*';
    }

    if (name.normalized) return NAMES.NORMALIZED + name.normalized;

    // FIXME: backstop goes here
    // return '*';
    return NAMES.URI + path;
  }
};
