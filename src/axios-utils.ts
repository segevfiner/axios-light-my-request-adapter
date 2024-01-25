import { Readable } from "stream";

// // eslint-disable-next-line @typescript-eslint/unbound-method
// const toString = Object.prototype.toString;

// // eslint-disable-next-line func-names
// const kindOf = (function (cache) {
//   // eslint-disable-next-line func-names
//   return function (thing: unknown) {
//     const str = toString.call(thing);
//     return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
//   };
// })(Object.create(null) as Record<string, string>);

// function kindOfTest<T>(type: string) {
//   type = type.toLowerCase();
//   return function isKindOf(thing: unknown): thing is T {
//     return kindOf(thing) === type;
//   };
// }

// /**
//  * Determine if a value is an Array
//  *
//  * @param {Object} val The value to test
//  * @returns {boolean} True if value is an Array, otherwise false
//  */
// export function isArray<T>(val: unknown): val is T[] {
//   return Array.isArray(val);
// }

// /**
//  * Determine if a value is an Object
//  *
//  * @param {Object} val The value to test
//  * @returns {boolean} True if value is an Object, otherwise false
//  */
// export function isObject(val: unknown): val is object {
//   return val !== null && typeof val === "object";
// }

// export const isDate = kindOfTest<Date>("Date");

// /**
//  * Determine if a value is a Function
//  *
//  * @param {Object} val The value to test
//  * @returns {boolean} True if value is a Function, otherwise false
//  */
// // eslint-disable-next-line @typescript-eslint/ban-types
// export function isFunction(val: unknown): val is Function {
//   return toString.call(val) === "[object Function]";
// }

// /**
//  * Determine if a value is a Stream
//  *
//  * @param {Object} val The value to test
//  * @returns {boolean} True if value is a Stream, otherwise false
//  */
// export function isStream(val: unknown) {
//   return isObject(val) && isFunction((val as { pipe: Readable["pipe"] }).pipe);
// }

// declare interface Headers {
//   [key: string]: string | number | boolean;
// }

// declare class FormData {
//   getHeaders(userHeaders?: Headers): Headers;
// }

// /**
//  * Determine if a value is a FormData
//  *
//  * @param {Object} thing The value to test
//  * @returns {boolean} True if value is an FormData, otherwise false
//  */
// export function isFormData(thing: unknown): thing is FormData {
//   const pattern = "[object FormData]";
//   return (
//     thing != null &&
//     ((typeof FormData === "function" && thing instanceof FormData) ||
//       toString.call(thing) === pattern ||
//       (isFunction((thing as { toString?: typeof toString })?.toString) &&
//         (thing as { toString: typeof toString }).toString() === pattern))
//   );
// }

// /**
//  * Determine if a value is a URLSearchParams object
//  * @function
//  * @param {Object} val The value to test
//  * @returns {boolean} True if value is a URLSearchParams object, otherwise false
//  */
// export const isURLSearchParams = kindOfTest<URLSearchParams>("URLSearchParams");

// /**
//  * Iterate over an Array or an Object invoking a function for each item.
//  *
//  * If `obj` is an Array callback will be called passing
//  * the value, index, and complete array for each item.
//  *
//  * If 'obj' is an Object callback will be called passing
//  * the value, key, and complete object for each property.
//  *
//  * @param {Object|Array} obj The object to iterate
//  * @param {Function} fn The callback to invoke for each item
//  */
// export function forEach<T extends object>(
//   obj: T | null | undefined,
//   fn: (val: T[keyof T], key: keyof T, obj: T) => void
// ): void;
// export function forEach<T extends S[], S>(
//   obj: T | null | undefined,
//   fn: (val: S, key: number, obj: T) => void
// ): void;
// export function forEach<T extends object | S[], S>(
//   obj: T | null | undefined,
//   fn:
//     | ((val: T[keyof T], key: keyof T, obj: T) => void)
//     | ((val: S, key: number, obj: T) => void)
// ): void {
//   // Don't bother if no value provided
//   if (obj === null || typeof obj === "undefined") {
//     return;
//   }

//   // Force an array if not already something iterable
//   if (typeof obj !== "object") {
//     (fn as (val: S, key: number, obj: T) => void).call(null, obj, 0, obj);
//   } else if (isArray<S>(obj)) {
//     // Iterate over array values
//     for (let i = 0, l = obj.length; i < l; i++) {
//       (fn as (val: S, key: number, obj: T) => void).call(null, obj[i], i, obj);
//     }
//   } else {
//     // Iterate over object keys
//     for (const key in obj) {
//       if (Object.prototype.hasOwnProperty.call(obj, key)) {
//         (fn as (val: T[keyof T], key: keyof T, obj: T) => void).call(
//           null,
//           obj[key],
//           key,
//           obj
//         );
//       }
//     }
//   }
// }

/**
 * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
 *
 * @param {string} content with BOM
 * @return {string} content value without BOM
 */
export function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }
  return content;
}

// /**
//  * Resolve object with deep prototype chain to a flat object
//  * @param {Object} sourceObj source object
//  * @param {Object} [destObj]
//  * @param {Function} [filter]
//  * @returns {Object}
//  */
// export function toFlatObject(
//   sourceObj: unknown,
//   destObj: unknown,
//   filter: (sourceObj: unknown, destObj: unknown) => boolean
// ): unknown {
//   let props;
//   let i;
//   let prop;
//   const merged = {};

//   destObj = destObj || {};

//   do {
//     props = Object.getOwnPropertyNames(sourceObj);
//     i = props.length;
//     while (i-- > 0) {
//       prop = props[i];
//       /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
//       if (!(merged as any)[prop]) {
//         (destObj as any)[prop] = (sourceObj as any)[prop];
//         (merged as any)[prop] = true;
//       }
//       /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
//     }
//     sourceObj = Object.getPrototypeOf(sourceObj);
//   } while (
//     sourceObj &&
//     (!filter || filter(sourceObj, destObj)) &&
//     sourceObj !== Object.prototype
//   );

//   return destObj;
// }
