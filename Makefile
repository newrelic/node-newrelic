SHELL := /bin/bash
NODE   = node
EXPRESSO = node_modules/expresso/bin/expresso
MOCHA = node_modules/mocha/bin/mocha

test: newtest oldtest

oldtest:
	@$(EXPRESSO) test/*test.js

newtest:
	@$(MOCHA) test/*.mocha.js

.PHONY: test
