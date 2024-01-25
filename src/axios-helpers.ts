import { AxiosError } from "axios";
import * as utils from "./axios-utils";
import { Blob } from "buffer";

const DATA_URL_PATTERN = /^(?:([^;]+);)?(?:[^;]+;)?(base64|),([\s\S]*)$/;

function parseProtocol(url: string) {
  const match = /^([-+\w]{1,25})(:?\/\/|:)/.exec(url);
  return (match && match[1]) || "";
}

/**
 * Parse data uri to a Buffer or Blob
 *
 * @param {String} uri
 * @param {?Boolean} asBlob
 * @param {?Object} options
 * @param {?Function} options.Blob
 *
 * @returns {Buffer|Blob}
 */
export function fromDataURI(
  uri: string,
  asBlob: boolean,
  options: { Blob?: typeof Blob },
) {
  const _Blob = (options && options.Blob) || Blob;
  const protocol = parseProtocol(uri);

  if (asBlob === undefined && _Blob) {
    asBlob = true;
  }

  if (protocol === "data") {
    uri = protocol.length ? uri.slice(protocol.length + 1) : uri;

    const match = DATA_URL_PATTERN.exec(uri);

    if (!match) {
      throw new AxiosError("Invalid URL", AxiosError.ERR_INVALID_URL);
    }

    const mime = match[1];
    const isBase64 = match[2];
    const body = match[3];
    const buffer = Buffer.from(
      decodeURIComponent(body),
      isBase64 ? "base64" : "utf8",
    );

    if (asBlob) {
      if (!_Blob) {
        throw new AxiosError(
          "Blob is not supported",
          AxiosError.ERR_NOT_SUPPORT,
        );
      }

      return new _Blob([buffer], { type: mime });
    }

    return buffer;
  }

  throw new AxiosError(
    "Unsupported protocol " + protocol,
    AxiosError.ERR_NOT_SUPPORT,
  );
}
