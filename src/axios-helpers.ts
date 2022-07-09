import * as utils from './axios-utils';

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
export function isAbsoluteURL(url: string): boolean{
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
}

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
export function combineURLs(baseURL: string, relativeURL: string): string {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
}

function encode(val: string): string {
  return encodeURIComponent(val).
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
export function buildURL(url: string, params: object, paramsSerializer?: (params: unknown) => string): string {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  let serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    const parts: string[] = [];

    // utils.forEach(params, function serialize(val?: string | string[], key?: string) {
    //   if (val === null || typeof val === 'undefined') {
    //     return;
    //   }

    //   if (utils.isArray(val)) {
    //     key = key + '[]';
    //   } else {
    //     val = [val];
    //   }

    //   utils.forEach(val, function parseValue(v) {
    //     if (utils.isDate(v)) {
    //       v = v.toISOString();
    //     } else if (utils.isObject(v)) {
    //       v = JSON.stringify(v);
    //     }
    //     parts.push(encode(key) + '=' + encode(v));
    //   });
    // });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    const hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }

    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
}
