import {Clause} from './clause_types';
import {BooleanSerializer} from './boolean_serializer';
import {StringSerializer} from './string_serializer';
import {NumberSerializer} from './number_serializer';
import {DateSerializer} from './date_serializer';
import {BaseSerializer} from './base_serializer';

export type FilterType = 'boolean' | 'number' | 'string' | 'date';

export interface FilterSerializerResponse {
  result: string;
  error?: string;
}

export class FilterSerializer {
  constructor(
    private input: Clause[],
    private type: FilterType
  ) {
    this.input = input;
    this.type = type;
  }

  private initSerializer(): BaseSerializer {
    switch (this.type) {
      case 'boolean':
        return new BooleanSerializer(this.input);
      case 'number':
        return new NumberSerializer(this.input);
      case 'string':
        return new StringSerializer(this.input);
      case 'date':
        return new DateSerializer(this.input);
    }
  }

  public serialize(): FilterSerializerResponse {
    try {
      const serializer = this.initSerializer();
      return {result: serializer.serialize()};
    } catch (ex: Error | unknown) {
      if (ex instanceof Error) {
        return {result: '', error: ex.message};
      } else {
        return {result: '', error: 'Unknown error ' + ex};
      }
    }
  }
}
