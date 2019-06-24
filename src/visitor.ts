import { ParsedConfig, BaseVisitor, EnumValuesMap, indentMultiline, indent } from '@graphql-codegen/visitor-plugin-common';
import { DartResolversPluginRawConfig } from './index';
import { GraphQLSchema, EnumTypeDefinitionNode, EnumValueDefinitionNode, FieldDefinitionNode, ObjectTypeDefinitionNode, TypeNode, Kind, NamedTypeNode, InterfaceTypeDefinitionNode, isScalarType, isObjectType, isEnumType } from 'graphql';
import { DART_SCALARS, wrapTypeWithModifiers } from './dart-common';
import { DartDeclarationBlock } from './dart-declaration-block';

export interface DartResolverParsedConfig extends ParsedConfig {
  listType: string;
  enumValues: EnumValuesMap;
  imports: string[];
}

export class DartResolversVisitor extends BaseVisitor<DartResolversPluginRawConfig, DartResolverParsedConfig> {
  constructor(rawConfig: DartResolversPluginRawConfig, private _schema: GraphQLSchema) {
    super(
      rawConfig,
      {
        enumValues: rawConfig.enumValues || {},
        listType: rawConfig.listType || 'List',
        imports: rawConfig.imports || [],
      },
      DART_SCALARS
    );
  }

  public getImports(): string {
    return this.config.imports.map(i => `import '${i}';`).join('\n') + '\n';
  }

  protected getEnumValue(enumName: string, enumOption: string): string {
    if (this.config.enumValues[enumName] && typeof this.config.enumValues[enumName] === 'object' && this.config.enumValues[enumName][enumOption]) {
      return this.config.enumValues[enumName][enumOption];
    }

    return enumOption;
  }

  EnumValueDefinition(node: EnumValueDefinitionNode): (enumName: string) => string {
    return (enumName: string) => {
      return indent(this.getEnumValue(enumName, node.name.value));
    };
  }

  EnumTypeDefinition(node: EnumTypeDefinitionNode): string {
    const enumName = this.convertName(node.name);
    const enumValues = node.values.map(enumValue => (enumValue as any)(node.name.value)).join(',\n');

    return new DartDeclarationBlock()
      .asKind('enum')
      .withComment(node.description)
      .withName(enumName)
      .withBlock(enumValues).string;
  }

  protected extractInnerType(typeNode: TypeNode): NamedTypeNode {
    if (typeNode.kind === Kind.NON_NULL_TYPE || typeNode.kind === Kind.LIST_TYPE) {
      return this.extractInnerType(typeNode.type);
    } else {
      return typeNode;
    }
  }

  protected resolveFieldType(
    typeNode: TypeNode
  ): {
    baseType: string;
    typeName: string;
    isScalar: boolean;
    isArray: boolean;
    isEnum: boolean;
  } {
    const innerType = this.extractInnerType(typeNode);
    const schemaType = this._schema.getType(innerType.name.value);
    const isArray = typeNode.kind === Kind.LIST_TYPE || (typeNode.kind === Kind.NON_NULL_TYPE && typeNode.type.kind === Kind.LIST_TYPE);
    let result: {
      baseType: string;
      typeName: string;
      isScalar: boolean;
      isArray: boolean;
      isEnum: boolean;
    } = null;

    if (isScalarType(schemaType)) {
      if (this.config.scalars[schemaType.name]) {
        result = {
          baseType: this.config.scalars[schemaType.name],
          typeName: this.config.scalars[schemaType.name],
          isScalar: true,
          isArray,
          isEnum: false,
        };
      } else {
        result = {
          isArray,
          baseType: 'Object',
          typeName: 'Object',
          isScalar: true,
          isEnum: false,
        };
      }
    } else if (isObjectType(schemaType)) {
      result = {
        baseType: `${this.convertName(schemaType.name)}`,
        typeName: `${this.convertName(schemaType.name)}`,
        isScalar: false,
        isArray,
        isEnum: false,
      };
    } else if (isEnumType(schemaType)) {
      result = {
        isArray,
        baseType: this.convertName(schemaType.name),
        typeName: this.convertName(schemaType.name),
        isScalar: true,
        isEnum: true,
      };
    } else {
      result = {
        isArray,
        baseType: 'Object',
        typeName: 'Object',
        isScalar: true,
        isEnum: false,
      };
    }

    if (result) {
      result.typeName = wrapTypeWithModifiers(result.typeName, typeNode, this.config.listType);
    }

    return result;
  }

  protected fieldsTransformer(fields: ReadonlyArray<FieldDefinitionNode>): string {
    return fields
      .map(arg => {
        const typeToUse = this.resolveFieldType(arg.type);

        return indent(`${typeToUse.typeName} ${arg.name.value};`);
      })
      .join('\n');
  }

  protected objectTypeTransformer(node: ObjectTypeDefinitionNode): string {
    const name = this.convertName(node);
    const fields = node.fields;
    const interfaces = node.interfaces.map(i => this._schema.getType(i.name.value));

    const inheritedFields = interfaces.flatMap(node => (node.astNode as InterfaceTypeDefinitionNode).fields);
    const allFields: FieldDefinitionNode[] = [];

    for (const field of fields.concat(inheritedFields)) {
      if (!allFields.some(existing => field.name.value === existing.name.value)) {
        allFields.push(field);
      }
    }

    const classMembers = this.fieldsTransformer(allFields);

    const ctorSet = allFields.map(arg => indent(`this.${arg.name.value},`, 2)).join('\n');

    const mapFactorySet = allFields
      .map(arg => {
        const typeToUse = this.resolveFieldType(arg.type);

        if (typeToUse.isArray && !typeToUse.isScalar) {
          return indentMultiline(
            `${arg.name.value}: (json['${arg.name.value}'] as List)?.map((e) => e == null ?
  null\n  : ${typeToUse.baseType}.fromJson(e as Map<String, dynamic>)
)?.toList()`,
            3
          );
        } else if (typeToUse.isEnum) {
          return indent(`${arg.name.value}: ${typeToUse.typeName}.values.firstWhere((e) => e.toString() == '${typeToUse.typeName}.' + json['${arg.name.value}'] as ${typeToUse.typeName})`, 3);
        } else if (typeToUse.isScalar) {
          return indent(`${arg.name.value}: json['${arg.name.value}'] as ${typeToUse.typeName}`, 3);
        } else {
          return indent(`${arg.name.value}: json['${arg.name.value}'] == null ? null : ` + `${typeToUse.typeName}.fromJson(json['${arg.name.value}'] as Map<String, dynamic>)`, 3);
        }
      })
      .join(',\n');

    const block = `
${classMembers}
  ${name}({
${ctorSet}
  });

  factory ${name}.fromJson(Map<String, dynamic> json) {
    return ${name}(
${mapFactorySet}
    );
  }
`;
    return new DartDeclarationBlock()
      .asKind('class')
      .withName(name)
      .extends(interfaces.map(node => this.convertName(node.name)))
      .withBlock(block).string;
  }

  protected interfaceTypeTransformer(name: string, fields: ReadonlyArray<FieldDefinitionNode>): string {
    const interfaceFields = this.fieldsTransformer(fields);
    return new DartDeclarationBlock()
      .asKind('abstract class')
      .withName(name)
      .withBlock(interfaceFields).string;
  }

  ObjectTypeDefinition(node: ObjectTypeDefinitionNode): string {
    if (node.name.value === 'Query') {
      return '';
    }

    return this.objectTypeTransformer(node);
  }

  InterfaceTypeDefinition(node: InterfaceTypeDefinitionNode): string {
    return this.interfaceTypeTransformer(this.convertName(node), node.fields);
  }
}
