import { Kind, TypeNode } from 'graphql';

export const DART_SCALARS = {
  ID: 'String',
  String: 'String',
  Boolean: 'bool',
  Int: 'int',
  Float: 'float',
};

export function wrapTypeWithModifiers(baseType: string, typeNode: TypeNode, listType = 'List'): string {
  if (typeNode.kind === Kind.NON_NULL_TYPE) {
    return wrapTypeWithModifiers(baseType, typeNode.type, listType);
  } else if (typeNode.kind === Kind.LIST_TYPE) {
    const innerType = wrapTypeWithModifiers(baseType, typeNode.type, listType);
    return `${listType}<${innerType}>`;
  } else {
    return baseType;
  }
}
