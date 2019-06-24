import { transformComment } from '@graphql-codegen/visitor-plugin-common';
import { StringValueNode, NameNode } from 'graphql';

export type Kind = 'class' | 'abstract class' | 'enum';

export class DartDeclarationBlock {
  _name: string = null;
  _extendStr: string[] = [];
  _kind: Kind = null;
  _block = null;
  _comment = null;

  asKind(kind: Kind): DartDeclarationBlock {
    this._kind = kind;

    return this;
  }

  withComment(comment: string | StringValueNode | null): DartDeclarationBlock {
    if (comment) {
      this._comment = transformComment(comment, 0);
    }

    return this;
  }

  withBlock(block: string): DartDeclarationBlock {
    this._block = block;

    return this;
  }

  extends(extendStr: string[]): DartDeclarationBlock {
    this._extendStr = extendStr;

    return this;
  }

  withName(name: string | NameNode): DartDeclarationBlock {
    this._name = typeof name === 'object' ? (name as NameNode).value : name;

    return this;
  }

  public get string(): string {
    let result = '';

    if (this._kind) {
      let name = '';

      if (this._name) {
        name = this._name;
      }

      let extendStr = '';

      if (this._extendStr.length > 0) {
        extendStr = ` extends ${this._extendStr.join(', ')}`;
      }

      result += `${this._kind} ${name}${extendStr} `;
    }

    if (this._block) {
      const before = '{';
      const after = '}';
      const block = [before, this._block, after].join('\n');
      result += block;
    } else {
      result += '{}';
    }

    return (this._comment ? this._comment : '') + result + '\n';
  }
}
