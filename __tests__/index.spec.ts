'use strict';

import 'jest';
import { addResolveFunctionsToSchema, getScehmaResolvers } from '../src';
import { GraphQLScalarType, graphql, buildSchema } from 'graphql';

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

describe('getScehmaResolvers', () => {
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
      const resolvers = getScehmaResolvers(schema);

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
      const resolvers = getScehmaResolvers(schema);

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
      const resolvers = getScehmaResolvers(schema);

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
      const resolvers = getScehmaResolvers(schema);

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
      const resolvers = getScehmaResolvers(schema);

      expect(resolvers).toEqual(originalResolvers);
    });
});
