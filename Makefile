TAP          = node_modules/.bin/tap
INTEGRATION  =  test/integration/*.tap.js
INTEGRATION  += test/integration/*/*.tap.js
INTEGRATION  += test/integration/*/*/*.tap.js

sub_node_modules:
	@node test/bin/install_sub_deps

docker:
	@HOST=`docker-machine ip default 2>/dev/null`; \
	if test "$${HOST}"; then \
	  echo "Using docker-machine host through IP $${HOST}"; \
	  export NR_NODE_TEST_MEMCACHED_HOST=$${HOST}; \
	  export NR_NODE_TEST_MONGODB_HOST=$${HOST}; \
	  export NR_NODE_TEST_MYSQL_HOST=$${HOST}; \
	  export NR_NODE_TEST_REDIS_HOST=$${HOST}; \
	  export NR_NODE_TEST_CASSANDRA_HOST=$${HOST}; \
	  export NR_NODE_TEST_POSTGRES_HOST=$${HOST}; \
	  export NR_NODE_TEST_RABBIT_HOST=$${HOST}; \
	fi; \

integration: sub_node_modules ca-gen $(CERTIFICATE) docker
	time $(TAP) $(INTEGRATION) --timeout=120

versioned: node_modules ca-gen $(CERTIFICATE) docker
	time ./bin/run-versioned-tests.sh

# versions prior to 1.4(ish) can't upgrade themselves directly to latest so hop to 1.4.28 first.
# Only upgrade to latest if we are on node 0.x
update_npm_global:
	if npm -v | grep -q "^1"; then \
	  npm install -g npm@1.4.28; \
	fi

	if node -v | grep -q "^v0"; then \
	  npm install -g npm@3; \
	fi

	echo "\nUpgrading npm is expected to have many warnings due to tolerance changes over the years.\n"
