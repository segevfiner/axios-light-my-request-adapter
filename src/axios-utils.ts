import FormData from 'form-data';
import { Readable } from 'stream';

const toString = Object.prototype.toString;

// eslint-disable-next-line func-names
const kindOf = (function(cache) {
  // eslint-disable-next-line func-names
  return function(thing: unknown) {
    const str = toString.call(thing);
    return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
  };
})(Object.create(null));

function kindOfTest<T>(type: string) {
  type = type.toLowerCase();
  return function isKindOf(thing: unknown): thing is T {
    return kindOf(thing) === type;
  };
}

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
export function isArray<T>(val: unknown): val is T[] {
  return Array.isArray(val);
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
 export function isObject(val: unknown): val is object {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
 // eslint-disable-next-line @typescript-eslint/ban-types
 export function isFunction(val: unknown): val is Function {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
export function isStream(val: unknown) {
  return isObject(val) && isFunction((val as {pipe: Readable['pipe']}).pipe);
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} thing The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
 export function isFormData(thing: unknown): thing is FormData {
    const pattern = '[object FormData]';
    return (
      (typeof FormData === 'function' && thing instanceof FormData) ||
      toString.call(thing) === pattern ||
      (isFunction((thing as {toString: typeof toString}).toString) && (thing as {toString: typeof toString}).toString() === pattern)
    );
  }

/**
 * Determine if a value is a URLSearchParams object
 * @function
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
export const isURLSearchParams = kindOfTest<URLSearchParams>('URLSearchParams');
