'use strict';

import 'jest';
import {
  getSchemaSubscriptions,
  addSubscriptionChannelsToSchema,
  addResolveFunctionsToSchema,
  getSchemaResolvers,
  composeSchema,
  decomposeSchema,
} from '../src';
import {
  print,
  parse,
  subscribe,
  GraphQLScalarType,
  graphql,
  buildSchema,
} from 'graphql';
import { GraphQLDateTime } from 'graphql-iso-date';
import { createAsyncIterator } from 'iterall';

describe('addResolveFunctionsToSchema', () => {
    it('Should be pass sanity', () => {
        expect(typeof addResolveFunctionsToSchema).toBe('function');
    });

    it("Works for basic schema", async () => {
      const schema = buildSchema(`
        type Query {
          simpleInt: Int
          simpleString: String
        }
      `);

      let intVisit = false;
      let stringVisit = false;
      addResolveFunctionsToSchema(schema, {
        Query: {
          simpleInt: () => {
            intVisit = true;
            return 0;
          },
          simpleString: () => {
            stringVisit = true;
            return 'Hello';
          },
        },
      });
      const query = `query {
        simpleInt
      }`;

      const result = await graphql(schema, query);

      expect(intVisit).toBe(true);
      expect(stringVisit).toBe(false);
      expect(result).toMatchSnapshot();
    });

    it("Should not allow types not in schema", () => {
      const schema = buildSchema(`
        type Query {
          simpleInt: Int
          simpleString: String
        }
      `);

      try {
        addResolveFunctionsToSchema(schema, {
          Query: {
            simpleInt: () => 0,
            simpleString: () => 'Hello',
          },
          SomeType: {
            intVisit: () => 0,
          },
        });
      } catch (e) {
        expect(e.message).toBe('"SomeType" defined in resolvers, but not in schema');
        return;
      }

      // Shouldn't get here.
      expect(false).toBe(true);
    });

    it("Should not allow non-function resolvers", () => {
      const schema = buildSchema(`
        type Query {
          simpleInt: Int
          simpleString: String
        }
      `);

      try {
        addResolveFunctionsToSchema(schema, {
          Query: {
            simpleInt: 0,
            simpleString: () => 'Hello',
          },
        } as any);
      } catch (e) {
        expect(e.message).toBe('"Query.simpleInt" is not a function');
        return;
      }

      // Shouldn't get here.
      expect(false).toBe(true);
    });

    it("Should not accept resolvers for enum", () => {
      const schema = buildSchema(`
        enum A {
          AA
          BB
        }

        type Query {
          simpleString: A
        }
      `);

      try {
        addResolveFunctionsToSchema(schema, {
          A: {
            AA: () => 0,
            BB: () => 1,
          },
          Query: {
            simpleInt: () => 0,
            simpleString: () => 'Hello',
          },
        });
      } catch (e) {
        expect(e.message).toBe('"A" was defined in resolvers, but it\'s not an object');
        return;
      }

      // Shouldn't get here.
      expect(false).toBe(true);
    });

    it("Should not accept undefined field resolvers", () => {
      const schema = buildSchema(`
        type Query {
          simpleString: String
        }
      `);

      try {
        addResolveFunctionsToSchema(schema, {
          Query: {
            simpleInt: () => 0,
            simpleString: () => 'Hello',
          },
        });
      } catch (e) {
        expect(e.message).toBe('"Query.simpleInt" defined in resolvers, but not in schema');
        return;
      }

      // Shouldn't get here.
      expect(false).toBe(true);
    });

    it("Should force scalar implementation", () => {
      const schema = buildSchema(`
        scalar DateTime

        type Query {
          simpleDate: DateTime
        }
      `);

      try {
        addResolveFunctionsToSchema(schema, {
          DateTime: {
            __serialize: () => null,
          },
          Query: {
            simpleDate: () => null,
          },
        });
      } catch (e) {
        expect(e.message).toBe('"DateTime" requires GraphQLScalarType Object');
        return
      }

      // Shouldn't get here.
      expect(false).toBe(true);
    });

    it("Should work with imported scalars", () => {
      const schema = buildSchema(`
        scalar DateTime

        type Query {
          simpleDate: DateTime
        }
      `);

      addResolveFunctionsToSchema(schema, {
        DateTime: GraphQLDateTime,
        Query: {
          simpleDate: () => new Date(),
        },
      });
    });

    it("Should not allow __resolveType for None-Union/Interface", () => {
      const schema = buildSchema(`
        union AorB = A | B
        type A {
          name: String
        }

        type B {
          age: Int
        }

        type Query {
          simpleDate: AorB
        }
      `);

      try {
        addResolveFunctionsToSchema(schema, {
          A: {
            __resolveType: (v) => 'A',
          },
          Query: {
            simpleDate: () => null,
          },
        });
      } catch (e) {
        expect(e.message).toBe('"A.__resolveType" invalid fieldName');
        return
      }

      // Shouldn't get here.
      expect(false).toBe(true);
    });

    it("Should not allow __isTypeOf for None-Objects", () => {
      const schema = buildSchema(`
        union AorB = A | B
        type A {
          name: String
        }

        type B {
          age: Int
        }

        type Query {
          simpleDate: AorB
        }
      `);

      try {
        addResolveFunctionsToSchema(schema, {
          AorB: {
            __isTypeOf: (v) => true,
          },
          Query: {
            simpleDate: () => null,
          },
        });
      } catch (e) {
        expect(e.message).toBe('"AorB.__isTypeOf" invalid fieldName');
        return
      }

      // Shouldn't get here.
      expect(false).toBe(true);
    });

    it("Should not allow user defined __resolvers", () => {
      const schema = buildSchema(`
        enum A {
          VALUE
        }

        type Query {
          simpleDate: A
        }
      `);

      try {
        addResolveFunctionsToSchema(schema, {
          A: {
            __something: (v) => true,
          },
          Query: {
            simpleDate: () => null,
          },
        });
      } catch (e) {
        expect(e.message).toBe('"A.__something" invalid fieldName');
        return
      }

      // Shouldn't get here.
      expect(false).toBe(true);
    });
});

describe('getSchemaResolvers', () => {
    it('Should be pass sanity', () => {
        expect(typeof addResolveFunctionsToSchema).toBe('function');
    });

    it("Works for basic schema", () => {
      const schema = buildSchema(`
        type Query {
          simpleInt: Int
          simpleString: String
          noResolver: Int
        }
      `);

      const originalResolvers =  {
        Query: {
          simpleInt: () => 0,
          simpleString: () => 'Hello',
        },
      };
      addResolveFunctionsToSchema(schema, originalResolvers);
      const resolvers = getSchemaResolvers(schema);

      expect(resolvers).toEqual(originalResolvers);
    });

    it("Works with scalars", () => {
      const schema = buildSchema(`
        scalar DateTime

        type Query {
          simpleDate: DateTime
        }
      `);

      const originalResolvers =  {
        DateTime: new GraphQLScalarType({
          name: 'DateTime',
          serialize: () => {},
        }),
        Query: {
          simpleDate: () => null,
        },
      };
      addResolveFunctionsToSchema(schema, originalResolvers);
      const resolvers = getSchemaResolvers(schema);

      expect(resolvers).toEqual(originalResolvers);
    });

    it("Works with imported scalar types", () => {
      const schema = buildSchema(`
        scalar DateTime

        type Query {
          simpleDate: DateTime
        }
      `);

      const originalResolvers =  {
        DateTime: GraphQLDateTime,
        Query: {
          simpleDate: () => new Date(),
        },
      };
      addResolveFunctionsToSchema(schema, originalResolvers);
      const resolvers = getSchemaResolvers(schema);

      expect(resolvers).toEqual(originalResolvers);
    });

    it("Works with union types", () => {
      const schema = buildSchema(`
        union AorB = A | B
        type A {
          name: String
        }

        type B {
          age: Int
        }

        type Query {
          simpleDate: AorB
        }
      `);

      const originalResolvers =  {
        AorB: {
          __resolveType: (v) => 'A',
        },
        Query: {
          simpleDate: () => null,
        },
      };
      addResolveFunctionsToSchema(schema, originalResolvers);
      const resolvers = getSchemaResolvers(schema);

      expect(resolvers).toEqual(originalResolvers);
    });

    it("Works with interface types", () => {
      const schema = buildSchema(`
        interface AorB {
          name: String
        }

        type A implements AorB {
          name: String
        }

        type B implements AorB {
          name: String
          age: Int
        }

        type Query {
          simpleDate: AorB
        }
      `);

      const originalResolvers =  {
        AorB: {
          __resolveType: (v) => 'B',
        },
        A: {
          __isTypeOf: (v) => true,
        },
        Query: {
          simpleDate: () => null,
        },
      };
      addResolveFunctionsToSchema(schema, originalResolvers);
      const resolvers = getSchemaResolvers(schema);

      expect(resolvers).toEqual(originalResolvers);
    });

    it("does not return without resolvers", () => {
      const schema = buildSchema(`
        type NoResolver {
          simpleInt: Int
        }

        type Query {
          simpleDate: NoResolver
        }
      `);

      const originalResolvers =  {
        Query: {
          simpleDate: () => null,
        },
      };
      addResolveFunctionsToSchema(schema, originalResolvers);
      const resolvers = getSchemaResolvers(schema);

      expect(resolvers).toEqual(originalResolvers);
    });
});

describe('addSubscriptionChannelsToSchema', () => {
  it('Should be pass sanity', () => {
    expect(typeof addSubscriptionChannelsToSchema).toBe('function');
  });

  it('Should work on simple example', async () => {
      const schema = buildSchema(`
        type Subscription {
          simpleInt: Int
        }

        type Query {
          simpleInt: Int
        }
      `);

      let subVisit = false;
      addResolveFunctionsToSchema(schema, {
        Subscription: {
          simpleInt: () => 0,
        },
        Query: {
          simpleInt: () => 0,
        },
      });
      addSubscriptionChannelsToSchema(schema, {
        simpleInt: () => {
          subVisit = true;
          return createAsyncIterator([ 0 ]);
        },
      });
      const query = `subscription {
        simpleInt
      }`;

      const result = await (await (subscribe(schema, parse(query)))).next();

      expect(subVisit).toBe(true);
      expect(result).toMatchSnapshot();
  });

  it("Should Fail if no subscription", () => {
    const schema = buildSchema(`
      type Query {
        simpleInt: Int
      }
    `);

    try {
      addSubscriptionChannelsToSchema(schema, {
        simpleInt: () => null,
      });
    } catch (e) {
      expect(e.message).toBe('No Subscription Type for schema');
      return
    }

    // Shouldn't get here.
    expect(false).toBe(true);
  });

  it("Should reject non-functions", () => {
    const schema = buildSchema(`
      type Subscription {
        simpleInt: Int
      }

      type Query {
        simpleInt: Int
      }
    `);

    try {
      addSubscriptionChannelsToSchema(schema, {
        simpleInt: 0,
      } as any);
    } catch (e) {
      expect(e.message).toBe('"simpleInt" is not a function');
      return
    }

    // Shouldn't get here.
    expect(false).toBe(true);
  });

  it("Should reject undefined fields", () => {
    const schema = buildSchema(`
      type Subscription {
        simpleInt: Int
      }

      type Query {
        simpleInt: Int
      }
    `);

    try {
      addSubscriptionChannelsToSchema(schema, {
        simpleString: () => 'Hello',
      });
    } catch (e) {
      expect(e.message).toBe('"simpleString" defined in subscription channels, but not in schema');
      return
    }

    // Shouldn't get here.
    expect(false).toBe(true);
  });
});

describe('getSchemaSubscriptions', () => {
  it('Should be pass sanity', () => {
    expect(typeof getSchemaSubscriptions).toBe('function');
  });

  it('Should work on simple example', () => {
      const schema = buildSchema(`
        type Subscription {
          simpleInt: Int
        }

        type Query {
          simpleInt: Int
        }
      `);

      addResolveFunctionsToSchema(schema, {
        Subscription: {
          simpleInt: () => 0,
        },
        Query: {
          simpleInt: () => 0,
        },
      });
      const originalSubscriptions = {
        simpleInt: () => createAsyncIterator([ 0 ]),
      };
      addSubscriptionChannelsToSchema(schema, originalSubscriptions);

      const subscriptions = getSchemaSubscriptions(schema);
      expect(subscriptions).toEqual(originalSubscriptions);
  });

  it('returns empty object if no subscriptions', () => {
      const schema = buildSchema(`
        type Query {
          simpleInt: Int
        }
      `);

      addResolveFunctionsToSchema(schema, {
        Query: {
          simpleInt: () => 0,
        },
      });
      const subscriptions = getSchemaSubscriptions(schema);
      expect(subscriptions).toEqual({});
  });

  it('does not return subscription if not given', () => {
      const schema = buildSchema(`
        type Subscription {
          simpleInt: Int
          simpleString: String
        }

        type Query {
          simpleInt: Int
        }
      `);

      addResolveFunctionsToSchema(schema, {
        Subscription: {
          simpleInt: () => 0,
        },
        Query: {
          simpleInt: () => 0,
        },
      });
      const originalSubscriptions = {
        simpleInt: () => createAsyncIterator([ 0 ]),
      };
      addSubscriptionChannelsToSchema(schema, originalSubscriptions);

      const subscriptions = getSchemaSubscriptions(schema);
      expect(subscriptions).toEqual(originalSubscriptions);
  });
});

describe('composeSchema', () => {
  it('Should be pass sanity', () => {
    expect(typeof composeSchema).toBe('function');
  });

  it('Able to compose simple schema', async () => {
    const schema = composeSchema({
      typeDefs: `
        type Query {
          simpleInt: Int
        }
      `,
      resolvers: {
        Query: {
          simpleInt: () => 0,
        },
      },
    });

    const query = `query {
      simpleInt
    }`;

    const result = await graphql(schema, query);

    expect(result).toMatchSnapshot();
  });

  it('Able to concat simple type definition', async () => {
    const schema = composeSchema({
      typeDefs: [`
        enum Test {
          TEST_ONE
          TEST_TWO
        }

        type Query {
          simpleInt: Int
        }
      `, `
        type Query {
          simpleString: String
        }
      `],
      resolvers: [{
        Query: {
          simpleInt: () => 0,
        },
      }, {
        Query: {
          simpleString: () => 'Hello',
        },
      }],
    });

    const query = `query {
      simpleInt
      simpleString
    }`;

    const result = await graphql(schema, query);

    expect(result).toMatchSnapshot();
  });

  it('works for subscriptions as well', async () => {
      let subVisit = false;
      let resolveVisit = false;
      const schema = composeSchema({
        typeDefs: `
          type Subscription {
            simpleInt: Int
          }

          type Query {
            simpleInt: Int
          }
        `,
        resolvers: {
          Subscription: {
            simpleInt: () => {
              resolveVisit = true;
              return 0;
            },
          },
          Query: {
            simpleInt: () => 0,
          },
        },
        subscriptions: {
          simpleInt: () => {
            subVisit = true;
            return createAsyncIterator([ 0 ]);
          },
        },
      });

      const query = `subscription {
        simpleInt
      }`;

      const result = await (await (subscribe(schema, parse(query)))).next();

      expect(subVisit).toBe(true);
      expect(resolveVisit).toBe(true);
      expect(result).toMatchSnapshot();
  });

  it('concats subscriptions as well', async () => {
      const schema = composeSchema({
        typeDefs: [`
          type Subscription {
            simpleInt: Int
          }

          type Query {
            simpleInt: Int
          }
        `, `
          type Subscription {
            simpleString: String
          }
        `],
        resolvers: [{
          Subscription: {
            simpleInt: () => 0,
          },
          Query: {
            simpleInt: () => 0,
          },
        }, {
          Subscription: {
            simpleString: (root) => root,
          },
        }],
        subscriptions: [{
          simpleInt: () => createAsyncIterator([ 0 ]),
        }, {
          simpleString: () => createAsyncIterator([ 'Hello' ]),
        }],
      });

      const query = `subscription {
        simpleString
      }`;

      const result = await (await (subscribe(schema, parse(query)))).next();
      expect(result).toMatchSnapshot();
  });

  it('works with scalars', async () => {
      const schema = composeSchema({
        typeDefs: [`
          type Query {
            simpleInt: Int
          }
        `, `
          scalar DateTime

          type Query {
            simpleDate: DateTime
          }
        `],
        resolvers: [{
          Query: {
            simpleInt: () => 0,
          },
        }, {
          DateTime: GraphQLDateTime,
          Query: {
            simpleDate: () => new Date(),
          },
        }],
      });

      const query = `query {
        simpleDate
      }`;

      const result = await graphql(schema, query);
      expect(result.data).toBeTruthy();
  });
});

describe('decomposeSchema', () => {
  it('Should be pass sanity', () => {
    expect(typeof decomposeSchema).toBe('function');
  });

  it('Able to compose simple schema', () => {
    const originalOptions = {
      typeDefs: print(parse(`
        type Query {
          simpleInt: Int
        }
      `)),
      resolvers: {
        Query: {
          simpleInt: () => 0,
        },
      },
      subscriptions: {},
    };
    const schema = composeSchema(originalOptions);
    const options = decomposeSchema(schema);

    expect(options).toEqual(originalOptions);
  });

});
