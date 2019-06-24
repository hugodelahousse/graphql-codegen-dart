import { parse, GraphQLSchema, printSchema, visit } from 'graphql';
import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import { RawConfig, EnumValuesMap } from '@graphql-codegen/visitor-plugin-common';
import { DartResolversVisitor } from './visitor';
import { dirname, normalize } from 'path';

export interface DartResolversPluginRawConfig extends RawConfig {
  /**
   * @name enumValues
   * @type EnumValuesMap
   * @description Overrides the default value of enum values declared in your GraphQL schema.
   *
   * @example With Custom Values
   * ```yml
   *   config:
   *     enumValues:
   *       MyEnum:
   *         A: 'foo'
   * ```
   */
  enumValues?: EnumValuesMap;
  /**
   * @name listType
   * @type string
   * @default List
   * @description Allow you to customize the list type
   *
   * @example
   * ```yml
   * generates:
   *   lib/models/graphql.dart:
   *     plugins:
   *       - dart
   *     config:
   *       listType: CustomList
   * ```
   */
  listType?: string;
  /**
   * @name imports
   * @type [string]
   * @default []
   * @description Allow you to add custom imports
   *
   * @example
   * ```yml
   * generates:
   *   lib/models/graphql.dart:
   *     plugins:
   *       - dart
   *     config:
   *       imports:
   *       - 'package:json_annotation/json_annotation.dart'
   * ```
   */
  imports?: [string];
}

export const plugin: PluginFunction<DartResolversPluginRawConfig> = async (schema: GraphQLSchema, documents: Types.DocumentFile[], config: DartResolversPluginRawConfig, { outputFile }): Promise<string> => {
  const relevantPath = dirname(normalize(outputFile));
  const visitor = new DartResolversVisitor(config, schema);
  const printedSchema = printSchema(schema);
  const astNode = parse(printedSchema);
  const visitorResult = visit(astNode, { leave: visitor as any });
  const imports = visitor.getImports();
  const blockContent = visitorResult.definitions.filter(d => typeof d === 'string').join('\n');

  return [imports, blockContent].join('\n');
};
