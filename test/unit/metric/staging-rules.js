'use strict'

// rules captured from the staging collector on 2012-08-29
module.exports = [
  {
    each_segment: false,
    eval_order: 0,
    terminate_chain: true,
    match_expression: '^(test_match_nothing)$',
    replace_all: false,
    ignore: false,
    replacement: '\\1'
  },
  {
    each_segment: false,
    eval_order: 0,
    terminate_chain: true,
    match_expression: '.*\\.(css|gif|ico|jpe?g|js|png|swf)$',
    replace_all: false,
    ignore: false,
    replacement: '/*.\\1'
  },
  {
    each_segment: false,
    eval_order: 0,
    terminate_chain: true,
    match_expression: '^(test_match_nothing)$',
    replace_all: false,
    ignore: false,
    replacement: '\\1'
  },
  {
    each_segment: false,
    eval_order: 0,
    terminate_chain: true,
    match_expression: '^(test_match_nothing)$',
    replace_all: false,
    ignore: false,
    replacement: '\\1'
  },
  {
    each_segment: false,
    eval_order: 0,
    terminate_chain: true,
    match_expression: '.*\\.(css|gif|ico|jpe?g|js|png|swf)$',
    replace_all: false,
    ignore: false,
    replacement: '/*.\\1'
  },
  {
    each_segment: false,
    eval_order: 0,
    terminate_chain: true,
    match_expression: '.*\\.(css|gif|ico|jpe?g|js|png|swf)$',
    replace_all: false,
    ignore: false,
    replacement: '/*.\\1'
  },
  {
    each_segment: true,
    eval_order: 1,
    terminate_chain: false,
    match_expression: '^[0-9][0-9a-f_,.-]*$',
    replace_all: false,
    ignore: false,
    replacement: '*'
  },
  {
    each_segment: true,
    eval_order: 1,
    terminate_chain: false,
    match_expression: '^[0-9][0-9a-f_,.-]*$',
    replace_all: false,
    ignore: false,
    replacement: '*'
  },
  {
    each_segment: true,
    eval_order: 1,
    terminate_chain: false,
    match_expression: '^[0-9][0-9a-f_,.-]*$',
    replace_all: false,
    ignore: false,
    replacement: '*'
  },
  {
    each_segment: false,
    eval_order: 2,
    terminate_chain: false,
    match_expression: '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
    replace_all: false,
    ignore: false,
    replacement: '\\1/.*\\2'
  },
  {
    each_segment: false,
    eval_order: 2,
    terminate_chain: false,
    match_expression: '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
    replace_all: false,
    ignore: false,
    replacement: '\\1/.*\\2'
  },
  {
    each_segment: false,
    eval_order: 2,
    terminate_chain: false,
    match_expression: '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
    replace_all: false,
    ignore: false,
    replacement: '\\1/.*\\2'
  }
]
