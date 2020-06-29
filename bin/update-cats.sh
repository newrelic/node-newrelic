#! /bin/sh

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

rm -rf test/lib/cross_agent_tests
git clone git@source.datanerd.us:newrelic/cross_agent_tests.git test/lib/cross_agent_tests
rm -rf test/lib/cross_agent_tests/.git