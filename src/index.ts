import {
  parse,
  print,
  buildASTSchema,
  buildSchema,
  extendSchema,
  printSchema,
  Kind,

  GraphQLBoolean,
  GraphQLField,
  GraphQLFieldMap,
  GraphQLFieldResolver,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,

  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  GraphQLType,
  GraphQLUnionType,
} from 'graphql';
import { recursive as merge } from 'merge';

export interface IResolvers<TSource, TContext> {
  [typeName: string]: GraphQLScalarType | {
    [fieldName: string]: GraphQLFieldResolver<TSource, TContext>,
  };
}

export interface ISubscriptions<TSource, TContext>  {
  [fieldName: string]: GraphQLFieldResolver<TSource, TContext>;
}

export function concatTypeDefs(typeDefs: string[]): string {
  const EXTEND = 'extend ';
  const concatResult = typeDefs
  .map((typeDef) => parse(typeDef))
  .reduce((state, typeDef) => {
    const thisTypeMap = [];
    const thisExtentions = [];
    const rawDef = typeDef.definitions.map((def) => {
      if ( def.kind !== Kind.OBJECT_TYPE_DEFINITION ) {
        return def;
      }
      const typeName = def.name.value;
      if ( (-1 === state.typeMap.indexOf(typeName)) &&
           (-1 === thisTypeMap.indexOf(typeName)) ) {
        thisTypeMap.push(typeName);
        return def;
      }

      const newStart = def.loc.start;
      const newEnd = def.loc.end + EXTEND.length;
      def.loc.start = EXTEND.length;
      def.loc.end = newEnd;

      thisExtentions.push({
        kind: Kind.TYPE_EXTENSION_DEFINITION,
        definition: def,
        loc: {
          start: newStart,
          end: newEnd,
        },
      });

      return null;
    }).filter((v) => v !== null);

    return {
      extentions: [ ...state.extentions, ...thisExtentions ],
      typeMap: [ ...state.typeMap, ...thisTypeMap ],
      typeDefs: [ ...state.typeDefs, ...rawDef ],
    };
  }, {
    extentions: [],
    typeMap: [],
    typeDefs: [],
  });

  const schema = extendSchema(buildASTSchema({
    kind: Kind.DOCUMENT,
    definitions: concatResult.typeDefs,
  }), {
    kind: Kind.DOCUMENT,
    definitions: concatResult.extentions,
  });

  return printSchema(schema);
}

export function concatResolvers<TSource, TContext>(
  resolvers: IResolvers<TSource, TContext>[],
): IResolvers<TSource, TContext> {
  return mergeObjects(resolvers);
}

export function concatSubscriptions<TSource, TContext>(
  subscriptions: ISubscriptions<TSource, TContext>[],
): ISubscriptions<TSource, TContext> {
  return mergeObjects(subscriptions);
}

export function makeExecutableSchema<TSource, TContext>(options: {
  typeDefs: string | string[],
  resolvers: (IResolvers<TSource, TContext> | IResolvers<TSource, TContext>[]),
  subscriptions?: (ISubscriptions<TSource, TContext> | ISubscriptions<TSource, TContext>[]),
}): GraphQLSchema {
  const argTypeDefs: string[] = forceArray(options.typeDefs);
  const argResolvers: IResolvers<TSource, TContext>[] = forceArray<IResolvers<TSource, TContext>>(options.resolvers);
  const finalTypeDef = concatTypeDefs(argTypeDefs);
  const schema = buildSchema(finalTypeDef);
  const finalResolvers = concatResolvers(argResolvers);

  addResolveFunctionsToSchema(schema, finalResolvers);

  if ( options.subscriptions &&
      (Object.keys(options.subscriptions).length > 0) ) {
    const argSubscriptions = forceArray<ISubscriptions<TSource, TContext>>(options.subscriptions);
    const finalSubscriptions = concatSubscriptions(argSubscriptions);
    addSubscriptionChannelsToSchema(schema, finalSubscriptions);
  }

  return schema;
};

export function addSubscriptionChannelsToSchema<TSource, TContext>(
  schema: GraphQLSchema,
  subscriptionFunctions: ISubscriptions<TSource, TContext>,
) {
  const type = schema.getSubscriptionType();
  if ( !type ) {
    throw new Error('No Subscription Type for schema');
  }
  const typeName = type.name;

  const fields = getFieldsForType(type);
  /* istanbul ignore if hell went loose */
  if (!fields) {
    throw new Error(
      `Subscription type ${typeName} is invalid`,
    );
  }

  Object.keys(subscriptionFunctions).forEach((fieldName) => {
    const fieldSubscribe = subscriptionFunctions[fieldName];
    if (typeof fieldSubscribe !== 'function') {
      throw new Error(`"${fieldName}" is not a function`);
    }

    if (!fields[fieldName]) {
      throw new Error(
        `"${fieldName}" defined in subscription channels, but not in schema`,
      );
    }

    setFieldProperties(fields[fieldName], { subscribe: fieldSubscribe });
  });
}

export function getScehmaSubscriptions<TSource, TContext>(schema: GraphQLSchema): ISubscriptions<TSource, TContext> {
  const type = schema.getSubscriptionType();
  if ( !type ) {
    return {};
  }
  const typeName = type.name;
  const fields = type.getFields();

  return Object.keys(fields).reduce((resolvers, fieldName) => {
    // tslint:disable-next-line
    const subChannel = fields[fieldName]['subscribe'];

    if ( typeof subChannel !== 'function' ) {
      return resolvers;
    }

    return {
      ...resolvers,
      [fieldName]: subChannel,
    };
  }, {});
}

export function addResolveFunctionsToSchema<TSource, TContext>(
  schema: GraphQLSchema,
  resolveFunctions: IResolvers<TSource, TContext>,
) {
  Object.keys(resolveFunctions).forEach((typeName) => {
    const type = schema.getType(typeName);
    if (!type && typeName !== '__schema') {
      throw new Error(
        `"${typeName}" defined in resolvers, but not in schema`,
      );
    }

    Object.keys(resolveFunctions[typeName]).forEach((fieldName) => {
      const fieldResolve = resolveFunctions[typeName][fieldName];
      if ( type instanceof GraphQLScalarType ) {
        if (resolveFunctions[typeName] instanceof GraphQLScalarType) {
          type[fieldName] = fieldResolve;
          return;
        } else {
          throw new Error(`"${typeName}" requires GraphQLScalarType Object`);
        }
      }

      if (fieldName.startsWith('__')) {
        setTypeProperty(type, typeName, fieldName, fieldResolve);
        return;
      }

      if (typeof fieldResolve !== 'function') {
        throw new Error(`"${typeName}.${fieldName}" is not a function`);
      }

      const fields = getFieldsForType(type);
      if (!fields) {
        throw new Error(
          `"${typeName}" was defined in resolvers, but it's not an object`,
        );
      }

      if (!fields[fieldName]) {
        throw new Error(
          `"${typeName}.${fieldName}" defined in resolvers, but not in schema`,
        );
      }

      setFieldProperties(fields[fieldName], { resolve: fieldResolve });
    });
  });
}

// get schema Resolvers, might be nice to open a PR for graphql-tools.
export function getScehmaResolvers<TSource, TContext>(schema: GraphQLSchema): IResolvers<TSource, TContext> {
  return Object.keys(schema.getTypeMap()).reduce((types, typeName) => {
    // Skip internal types.
    if ( typeName.startsWith('__') ) {
      return types;
    }

    const type: GraphQLType = schema.getType(typeName);
    let fieldResolvers = {};

    if ( type instanceof GraphQLObjectType ) {
      if ( type.isTypeOf ) {
        Object.assign(fieldResolvers, {
          __isTypeOf: type.isTypeOf,
        });
      }
    } else if ( (type instanceof GraphQLUnionType) ||
                (type instanceof GraphQLInterfaceType) ) {
      if ( type.resolveType ) {
        Object.assign(fieldResolvers, {
          __resolveType: type.resolveType,
        });
      }
    } else if ( (type instanceof GraphQLScalarType) ) {
      if ( isBaseScalar(type) ) {
        return types;
      }

      fieldResolvers = type;
    }

    const fields = getFieldsForType(type);
    if ( fields ) {
      fieldResolvers = {
        ...fieldResolvers,
        ...Object.keys(fields).reduce((resolvers, fieldName) => {
          if ( undefined === fields[fieldName].resolve ) {
            return resolvers;
          }

          return {
            ...resolvers,
            [fieldName]: fields[fieldName].resolve,
          };
        }, {}),
      };
    }

    if ( Object.keys(fieldResolvers).length === 0 ) {
      return types;
    }

    return {
      ...types,
      [typeName]: fieldResolvers,
    };
  }, {});
}

function setTypeProperty<TSource, TContext>(
  type: GraphQLType,
  typeName: string,
  fieldName: string,
  fieldResolve: GraphQLFieldResolver<TSource, TContext>,
): void {
  let invalid = false;
  if ( type instanceof GraphQLObjectType ) {
    if ( fieldName !== '__isTypeOf' ) {
      invalid = true;
    }
  } else if ( (type instanceof GraphQLUnionType) ||
              (type instanceof GraphQLInterfaceType) ) {
    if ( fieldName !== '__resolveType' ) {
      invalid = true;
    }
  } else {
    invalid = true;
  }

  if ( invalid ) {
    throw new Error(`"${typeName}.${fieldName}" invalid fieldName`);
  }

  type[fieldName.substring(2)] = fieldResolve;
}

function getFieldsForType(type: GraphQLType): GraphQLFieldMap<any, any> {
  if (
    type instanceof GraphQLObjectType ||
    type instanceof GraphQLInterfaceType
  ) {
    return type.getFields();
  } else {
    return undefined;
  }
}

function setFieldProperties(
  field: GraphQLField<any, any>,
  propertiesObj: object,
) {
  Object.keys(propertiesObj).forEach((propertyName) => {
    field[propertyName] = propertiesObj[propertyName];
  });
}

function isBaseScalar(type: GraphQLScalarType): boolean {
  return [
    GraphQLString,
    GraphQLInt,
    GraphQLFloat,
    GraphQLBoolean,
    GraphQLID,
  ].some((t) => (type.name === t.name));
}

function forceArray<T>(v: (T | T[])): T[] {
  return Array.isArray(v) ? v : [v];
}

function mergeObjects<T>(objects: T[]): T {
  return objects.reduce((last, next) => merge(true, last, next), {});
}
