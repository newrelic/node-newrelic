'use strict'
const utils = module.exports

/**
 * Adds the relevant CLM attrs(code.function and code.filepath) to span if
 * code_level_metrics.enabled is true and if span exists
 *
 * Note: This is not like the other in agent CLM support.  Next.js is very rigid
 * with its file structure and function names. We're providing relative paths to Next.js files
 * based on the Next.js page.  The function is also hardcoded to align with the conventions of Next.js.
 *
 * @param {Object} config agent config
 * @param {TraceSegment} segment active segment to add CLM attrs to
 * @param {Object} attrs list of CLM attrs to add to segment
 */
utils.assignCLMAttrs = function assignCLMAttrs(config, segment, attrs) {
  // config is optionally accessed because agent could be older than
  // when this configuration option was defined
  if (!(config?.code_level_metrics?.enabled && segment)) {
    return
  }

  for (const attr in attrs) {
    segment.addAttribute(attr, attrs[attr])
  }
}
