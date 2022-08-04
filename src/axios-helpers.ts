import * as utils from "./axios-utils";

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
export function isAbsoluteURL(url: string): boolean {
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
    ? baseURL.replace(/\/+$/, "") + "/" + relativeURL.replace(/^\/+/, "")
    : baseURL;
}

function encode(val: string | number | boolean): string {
  return encodeURIComponent(val)
    .replace(/%3A/gi, ":")
    .replace(/%24/g, "$")
    .replace(/%2C/gi, ",")
    .replace(/%20/g, "+")
    .replace(/%5B/gi, "[")
    .replace(/%5D/gi, "]");
}

// Based buildURL from axios/helpers
/**
 * Build URL params
 *
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
export function buildParams(
  params: unknown,
  paramsSerializer?: (params: unknown) => string
): string {
  if (!params) {
    return "";
  }

  let serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    const parts: string[] = [];

    utils.forEach(
      params as Record<string, unknown>,
      function serialize(val, key) {
        if (val === null || typeof val === "undefined") {
          return;
        }

        if (utils.isArray(val)) {
          key = key + "[]";
        } else {
          val = [val];
        }

        if (utils.isObject(val)) {
          utils.forEach(
            val as Record<string, Date | object | string | number | boolean>,
            function parseValue(v) {
              if (utils.isDate(v)) {
                v = v.toISOString();
              } else if (utils.isObject(v)) {
                v = JSON.stringify(v);
              }
              parts.push(encode(key) + "=" + encode(v));
            }
          );
        }
      }
    );

    serializedParams = parts.join("&");
  }

  return serializedParams;
}
