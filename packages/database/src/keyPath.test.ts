import { getKeyPathValue } from './keyPath';
import { describe, expect, test } from 'vitest';

type User = {
  id: number;
  name: string;
  callSign?: string;
  favorite?: {
    color: string;
    number: number;
    animal?: {
      id: number;
      name: string;
    };
  };
};

describe(getKeyPathValue, () => {
  const gandalf: User = {
    id: 1,
    name: 'Gandalf',
    callSign: 'Stormcrow',
    favorite: {
      color: 'Grey',
      number: 9,
      animal: {
        id: 2,
        name: 'Shadowfax',
      },
    },
  };

  const elrond: User = {
    id: 2,
    name: 'Elrond',
    favorite: {
      color: 'Blue',
      number: 3,
    },
  };

  const gimli: User = {
    id: 3,
    name: 'Gimli',
    callSign: "Gloin's Son",
  };

  test('top level key', () => {
    expect(getKeyPathValue(gandalf, 'id')).toBe(1);
    expect(getKeyPathValue(gandalf, 'name')).toBe('Gandalf');
    expect(getKeyPathValue(gandalf, 'callSign')).toBe('Stormcrow');
  });

  describe('nested key', () => {
    test('all parts present', () => {
      expect(getKeyPathValue(gandalf, 'favorite.color')).toBe('Grey');
      expect(getKeyPathValue(gandalf, 'favorite.number')).toBe(9);
      expect(getKeyPathValue(gandalf, 'favorite.animal.id')).toBe(2);
      expect(getKeyPathValue(gandalf, 'favorite.animal.name')).toBe(
        'Shadowfax',
      );
    });

    test('2nd level undefined', () => {
      expect(getKeyPathValue(gimli, 'favorite.color')).toBeUndefined();
      expect(getKeyPathValue(gimli, 'favorite.animal.id')).toBeUndefined();
    });

    test('3rd level undefined', () => {
      expect(getKeyPathValue(elrond, 'favorite.animal.id')).toBeUndefined();
    });
  });
});
