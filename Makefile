SHELL := /bin/bash
NODE   = node
EXPRESSO = node_modules/expresso/bin/expresso
MOCHA = node_modules/mocha/bin/mocha

test:
	@$(MOCHA)

.PHONY: test
