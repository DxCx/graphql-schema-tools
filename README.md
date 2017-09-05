# graphql-schema-tools
[![NPM version](https://img.shields.io/npm/v/graphql-schema-tools.svg)](https://www.npmjs.com/package/graphql-schema-tools)
[![Build Status](https://travis-ci.org/DxCx/graphql-schema-tools.svg?branch=master)](https://travis-ci.org/DxCx/graphql-schema-tools)
[![Coverage Status](https://coveralls.io/repos/github/DxCx/graphql-schema-tools/badge.svg?branch=master)](https://coveralls.io/github/DxCx/graphql-schema-tools?branch=master)
[![Standard Version](https://img.shields.io/badge/release-standard%20version-brightgreen.svg)](https://github.com/conventional-changelog/standard-version)

Functions & Utilitize for creating and stiching graphql schema.

What does it include:
----
	1. Basic functionality to compose typeDefs + resolvers into a schema.
	2. Support for `subscriptions` as well (subscribe function)
	3. Support for arrays of objects parts:
	    - if the same type found, it will be properly merged.
	4. Support for decomposing schema back to it's original parts 
	   (typeDefs, resolvers, subscriptions)

API
----
  - Functions Used to combine array of parts into 1 valid part:
	```typescript
	function concatTypeDefs(typeDefs: string[]): string;
	function concatResolvers(resolvers: IResolvers[]): IResolvers;
	function concatSubscriptions(subscriptions: ISubscriptions[]): ISubscriptions;
	```
  - Functions Used to compose & decompose Schema:
  	
	NOTE: `makeExecutableSchema` is alias of `composeSchema`.
	```typescript
	function composeSchema(options: IExecutableSchemaParts): GraphQLSchema;
	function makeExecutableSchema(options: IExecutableSchemaParts): GraphQLSchema;
	function decomposeSchema(schema: GraphQLSchema): IExecutableSchemaParts;
	```
  - Functions Used to handle with `subscribe` function across schema:
	```typescript
	function addSubscriptionChannelsToSchema(schema: GraphQLSchema, subscriptionFunctions: ISubscriptions): void;
	function getScehmaSubscriptions(schema: GraphQLSchema): ISubscriptions;
	```
  - Functions Used to handle with `resolve` function across schema:
	```typescript
	function addResolveFunctionsToSchema(schema: GraphQLSchema, resolveFunctions: IResolvers): void;
	function getScehmaResolvers(schema: GraphQLSchema): IResolvers;
	```

Examples
----
Until i'll find more time to write some examples,
you can refer to tests as simple examples.
	
Contribution
----
Contributions, issues and feature requests are very welcome. If you are using this package and fixed a bug for yourself, please consider submitting a PR!
