const typeOfTest = (type: string) => (thing: any) => typeof thing === type;

/**
 * Determine if a value is a Function
 *
 * @param {*} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
const isFunction = typeOfTest("function");

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

/**
 * If the thing is a FormData object, return true, otherwise return false.
 *
 * @param {unknown} thing - The thing to check.
 *
 * @returns {boolean}
 */
export function isSpecCompliantForm(thing: any) {
  return !!(
    thing &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    isFunction(thing.append) &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    thing[Symbol.toStringTag] === "FormData" &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    thing[Symbol.iterator]
  );
}
