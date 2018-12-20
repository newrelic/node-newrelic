TAP          = node_modules/.bin/tap
JSDOC        = node_modules/.bin/jsdoc
PACKAGE_VERSION = $(shell node -e 'console.log(require("./package").version)')
INTEGRATION  =  test/integration/*.tap.js
INTEGRATION  += test/integration/*/*.tap.js
INTEGRATION  += test/integration/*/*/*.tap.js
SMOKE        = test/smoke/*.tap.js
# subcomponents manage their own modules
PACKAGES = $(shell find . -name package.json -and -not -path '*/node_modules/*' -and -not -path '*/example*')
# strip the package.json from the results
NPMDIRS = $(PACKAGES:/package.json=)

.PHONY: all build test-cov test clean notes pending pending-core
.PHONY: unit integration ssl ca-gen smoke lint
.PHONY: sub_node_modules $(SUBNPM)

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

smoke: clean
	npm install --production --loglevel warn --no-package-lock
	npm install tap --no-package-lock
	@cd test/smoke && npm install --no-package-lock
	time $(TAP) $(SMOKE)

docs: node_modules
	$(JSDOC) -c ./jsdoc-conf.json --private -r .

public-docs: node_modules
	$(JSDOC) -c ./jsdoc-conf.json --tutorials examples/shim api.js lib/shim/ lib/transaction/handle.js
	cp examples/shim/*.png out/

publish-docs:
	git checkout gh-pages
	git pull origin gh-pages
	git merge -
	make public-docs
	git rm -r docs
	mv out docs
	git add docs
	git commit -m "docs: update for ${PACKAGE_VERSION}"
	git push origin gh-pages && git push public gh-pages:gh-pages

update_cross_agent_tests:
	rm -rf test/lib/cross_agent_tests
	git clone git@source.datanerd.us:newrelic/cross_agent_tests.git test/lib/cross_agent_tests
	rm -rf test/lib/cross_agent_tests/.git
