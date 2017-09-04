import {
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
} from "graphql";

export interface IResolvers<TSource, TContext> {
  [typeName: string]: GraphQLScalarType | {
    [fieldName: string]: GraphQLFieldResolver<TSource, TContext>,
  };
}

export interface ISubscriptions<TSource, TContext>  {
  [fieldName: string]: GraphQLFieldResolver<TSource, TContext>;
}

export function addSubscriptionChannelsToSchema<TSource, TContext>(
  schema: GraphQLSchema,
  subscriptionFunctions: ISubscriptions<TSource, TContext>,
) {
  const type = schema.getSubscriptionType();
  if ( !type ) {
    throw new Error("No Subscription Type for schema");
  }
  const typeName = type.name;

  const fields = getFieldsForType(type);
  if (!fields) {
    throw new Error(
      `Subscription type ${typeName} is invalid`,
    );
  }

  Object.keys(subscriptionFunctions).forEach((fieldName) => {
    const fieldSubscribe = subscriptionFunctions[fieldName];
    if (typeof fieldSubscribe !== "function") {
      throw new Error(`"${fieldName}" is not a function`);
    }

    if (!fields[fieldName]) {
      throw new Error(
        `${fieldName} defined in subscription channels, but not in schema`,
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
    if ( typeof fields[fieldName].subscribe !== "function" ) {
      return resolvers;
    }

    return {
      ...(resolvers || {}),
      [fieldName]: fields[fieldName].subscribe,
    };
  }, undefined);
}

export function addResolveFunctionsToSchema<TSource, TContext>(
  schema: GraphQLSchema,
  resolveFunctions: IResolvers<TSource, TContext>,
) {
  Object.keys(resolveFunctions).forEach((typeName) => {
    const type = schema.getType(typeName);
    if (!type && typeName !== "__schema") {
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

      if (fieldName.startsWith("__")) {
        setTypeProperty(type, fieldName, fieldResolve);
        return;
      }

      if (typeof fieldResolve !== "function") {
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
    if ( typeName.startsWith("__") ) {
      return types;
    }

    const type: GraphQLType = schema.getType(typeName);
    let fieldResolvers = {};

    if ( type instanceof GraphQLObjectType ) {
      if ( type.isTypeOf ) {
        fieldResolvers.__isTypeOf = type.isTypeOf;
      }
    } else if ( (type instanceof GraphQLUnionType) ||
                (type instanceof GraphQLInterfaceType) ) {
      if ( type.resolveType ) {
        fieldResolvers.__resolveType = type.resolveType;
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
  type: GraphQLNamedType,
  fieldName: string,
  fieldResolve: GraphQLFieldResolver<TSource, TContext>,
): void {
  let invalid = false;
  if ( type instanceof GraphQLObjectType ) {
    if ( fieldName !== "__isTypeOf" ) {
      invalid = true;
    }
  } else if ( (type instanceof GraphQLUnionType) ||
              (type instanceof GraphQLInterfaceType) ) {
    if ( fieldName !== "__resolveType" ) {
      invalid = true;
    }
  } else {
    invalid = true;
  }

  if ( invalid ) {
    throw new Error(`"${type.name}.${fieldName}" invalid fieldName`);
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
