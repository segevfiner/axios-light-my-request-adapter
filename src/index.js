"use strict";

import utils from "axios/unsafe/utils.js";
import settle from "./settle.js";
import buildFullPath from "axios/unsafe/core/buildFullPath.js";
import buildURL from "axios/unsafe/helpers/buildURL.js";
import AxiosTransformStream from "axios/unsafe/helpers/AxiosTransformStream.js";
import util from "util";
import zlib from "zlib";
import { AxiosError, AxiosHeaders, CanceledError, VERSION } from "axios";
import fromDataURI from "axios/unsafe/helpers/fromDataURI.js";
import stream from "stream";
import EventEmitter from "events";
import formDataToStream from "axios/unsafe/helpers/formDataToStream.js";
import readBlob from "axios/unsafe/helpers/readBlob.js";
import ZlibHeaderTransformStream from "axios/unsafe/helpers/ZlibHeaderTransformStream.js";
import inject from "light-my-request";

const transitionalDefaults = {
  silentJSONParsing: true,
  forcedJSONParsing: true,
  clarifyTimeoutError: false,
};

const zlibOptions = {
  flush: zlib.constants.Z_SYNC_FLUSH,
  finishFlush: zlib.constants.Z_SYNC_FLUSH,
};

const brotliOptions = {
  flush: zlib.constants.BROTLI_OPERATION_FLUSH,
  finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH,
};

const isBrotliSupported = utils.isFunction(zlib.createBrotliDecompress);

const supportedProtocols = ["http", "https", "file", "data"].map((protocol) => {
  return protocol + ":";
});

// temporary hotfix

const wrapAsync = (asyncExecutor) => {
  return new Promise((resolve, reject) => {
    let onDone;
    let isDone;

    const done = (value, isRejected) => {
      if (isDone) return;
      isDone = true;
      onDone && onDone(value, isRejected);
    };

    const _resolve = (value) => {
      done(value);
      resolve(value);
    };

    const _reject = (reason) => {
      done(reason, true);
      reject(reason);
    };

    asyncExecutor(
      _resolve,
      _reject,
      (onDoneHandler) => (onDone = onDoneHandler),
    ).catch(_reject);
  });
};

export function createLightMyRequestAdapter(dispatchFunc, opts = {}) {
  return function httpAdapter(config) {
    return wrapAsync(
      async function dispatchHttpRequest(resolve, reject, onDone) {
        let { data } = config;
        const { responseType, responseEncoding } = config;
        const method = config.method.toUpperCase();
        let isDone;
        let rejected = false;
        let timeout;

        if (config.maxRedirects != null) {
          reject(new Error("maxRedirects not supported"));
          return;
        }

        if (config.socketPath != null) {
          reject(new Error("socketPath not supported"));
          return;
        }

        if (config.proxy != null) {
          reject(new Error("proxy not supported"));
          return;
        }

        // temporary internal emitter until the AxiosRequest class will be implemented
        const emitter = new EventEmitter();

        const onFinished = () => {
          if (config.cancelToken) {
            config.cancelToken.unsubscribe(abort);
          }

          if (config.signal) {
            config.signal.removeEventListener("abort", abort);
          }

          emitter.removeAllListeners();

          if (timeout) {
            clearTimeout(timeout);
          }
        };

        onDone((value, isRejected) => {
          isDone = true;
          if (isRejected) {
            rejected = true;
            onFinished();
          }
        });

        function abort(reason) {
          emitter.emit(
            "abort",
            !reason || reason.type ? new CanceledError(null, config) : reason,
          );
        }

        emitter.once("abort", reject);

        if (config.cancelToken || config.signal) {
          config.cancelToken && config.cancelToken.subscribe(abort);
          if (config.signal) {
            config.signal.aborted
              ? abort()
              : config.signal.addEventListener("abort", abort);
          }
        }

        // Parse url
        const fullPath = buildFullPath(config.baseURL, config.url);
        const parsed = new URL(fullPath, "http://localhost");
        const protocol = parsed.protocol || supportedProtocols[0];

        if (protocol === "data:") {
          let convertedData;

          if (method !== "GET") {
            return settle(resolve, reject, {
              status: 405,
              statusText: "method not allowed",
              headers: {},
              config,
            });
          }

          try {
            convertedData = fromDataURI(config.url, responseType === "blob", {
              Blob: config.env && config.env.Blob,
            });
          } catch (err) {
            throw AxiosError.from(err, AxiosError.ERR_BAD_REQUEST, config);
          }

          if (responseType === "text") {
            convertedData = convertedData.toString(responseEncoding);

            if (!responseEncoding || responseEncoding === "utf8") {
              convertedData = utils.stripBOM(convertedData);
            }
          } else if (responseType === "stream") {
            convertedData = stream.Readable.from(convertedData);
          }

          return settle(resolve, reject, {
            data: convertedData,
            status: 200,
            statusText: "OK",
            headers: new AxiosHeaders(),
            config,
          });
        }

        if (supportedProtocols.indexOf(protocol) === -1) {
          return reject(
            new AxiosError(
              "Unsupported protocol " + protocol,
              AxiosError.ERR_BAD_REQUEST,
              config,
            ),
          );
        }

        const headers = AxiosHeaders.from(config.headers).normalize();

        // Set User-Agent (required by some servers)
        // See https://github.com/axios/axios/issues/69
        // User-Agent is specified; handle case where no UA header is desired
        // Only set header if it hasn't been set in config
        headers.set("User-Agent", "axios/" + VERSION, false);

        const onDownloadProgress = config.onDownloadProgress;
        const onUploadProgress = config.onUploadProgress;
        const maxRate = config.maxRate;
        let maxUploadRate = undefined;
        let maxDownloadRate = undefined;

        // support for spec compliant FormData objects
        if (utils.isSpecCompliantForm(data)) {
          const userBoundary = headers.getContentType(
            /boundary=([-_\w\d]{10,70})/i,
          );

          data = formDataToStream(
            data,
            (formHeaders) => {
              headers.set(formHeaders);
            },
            {
              tag: `axios-${VERSION}-boundary`,
              boundary: (userBoundary && userBoundary[1]) || undefined,
            },
          );
          // support for https://www.npmjs.com/package/form-data api
        } else if (
          utils.isFormData(data) &&
          utils.isFunction(data.getHeaders)
        ) {
          headers.set(data.getHeaders());

          if (!headers.hasContentLength()) {
            try {
              const knownLength = await util
                .promisify(data.getLength)
                .call(data);
              Number.isFinite(knownLength) &&
                knownLength >= 0 &&
                headers.setContentLength(knownLength);
              /*eslint no-empty:0*/
            } catch {}
          }
        } else if (utils.isBlob(data)) {
          data.size &&
            headers.setContentType(data.type || "application/octet-stream");
          headers.setContentLength(data.size || 0);
          data = stream.Readable.from(readBlob(data));
        } else if (data && !utils.isStream(data)) {
          if (Buffer.isBuffer(data)) {
            // Nothing to do...
          } else if (utils.isArrayBuffer(data)) {
            data = Buffer.from(new Uint8Array(data));
          } else if (utils.isString(data)) {
            data = Buffer.from(data, "utf-8");
          } else {
            return reject(
              new AxiosError(
                "Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream",
                AxiosError.ERR_BAD_REQUEST,
                config,
              ),
            );
          }

          // Add Content-Length header if data exists
          headers.setContentLength(data.length, false);

          if (config.maxBodyLength > -1 && data.length > config.maxBodyLength) {
            return reject(
              new AxiosError(
                "Request body larger than maxBodyLength limit",
                AxiosError.ERR_BAD_REQUEST,
                config,
              ),
            );
          }
        }

        const contentLength = utils.toFiniteNumber(headers.getContentLength());

        if (utils.isArray(maxRate)) {
          maxUploadRate = maxRate[0];
          maxDownloadRate = maxRate[1];
        } else {
          maxUploadRate = maxDownloadRate = maxRate;
        }

        if (data && (onUploadProgress || maxUploadRate)) {
          if (!utils.isStream(data)) {
            data = stream.Readable.from(data, { objectMode: false });
          }

          data = stream.pipeline(
            [
              data,
              new AxiosTransformStream({
                length: contentLength,
                maxRate: utils.toFiniteNumber(maxUploadRate),
              }),
            ],
            utils.noop,
          );

          onUploadProgress &&
            data.on("progress", (progress) => {
              onUploadProgress(
                Object.assign(progress, {
                  upload: true,
                }),
              );
            });
        }

        // HTTP basic authentication
        let auth = undefined;
        if (config.auth) {
          const username = config.auth.username || "";
          const password = config.auth.password || "";
          auth = username + ":" + password;
        }

        if (!auth && parsed.username) {
          const urlUsername = parsed.username;
          const urlPassword = parsed.password;
          auth = urlUsername + ":" + urlPassword;
        }

        if (auth) {
          headers.set(
            "authorization",
            "Basic " + Buffer.from(auth).toString("base64"),
          );
        }

        let url;

        try {
          url = buildURL(
            parsed.pathname + parsed.search,
            config.params,
            config.paramsSerializer,
          ).replace(/^\?/, "");
        } catch (err) {
          const customErr = new Error(err.message);
          customErr.config = config;
          customErr.url = config.url;
          customErr.exists = true;
          return reject(customErr);
        }

        headers.set(
          "Accept-Encoding",
          "gzip, compress, deflate" + (isBrotliSupported ? ", br" : ""),
          false,
        );

        // Create the request
        const controller = new AbortController();
        inject(
          dispatchFunc,
          {
            url,
            method,
            authority: parsed.host,
            headers,
            remoteAddress: opts.remoteAddress,
            payload: data,
            server: opts.server,
            signal: controller.signal,
          },
          (err, res) => {
            if (err) {
              reject(AxiosError.from(err, null, config, res?.raw.req));
              return;
            }

            if (res.raw.req.destroyed) return;

            const streams = [stream.Readable.from([res.rawPayload])];

            const responseLength = +res.headers["content-length"];

            if (onDownloadProgress) {
              const transformStream = new AxiosTransformStream({
                length: utils.toFiniteNumber(responseLength),
                maxRate: utils.toFiniteNumber(maxDownloadRate),
              });

              onDownloadProgress &&
                transformStream.on("progress", (progress) => {
                  onDownloadProgress(
                    Object.assign(progress, {
                      download: true,
                    }),
                  );
                });

              streams.push(transformStream);
            }

            // decompress the response body transparently if required
            let responseStream = res.raw.res;

            // return the last request in case of redirects
            const lastRequest = res.raw.req;

            // if decompress disabled we should not decompress
            if (
              config.decompress !== false &&
              res.headers["content-encoding"]
            ) {
              // if no content, but headers still say that it is encoded,
              // remove the header not confuse downstream operations
              if (method === "HEAD" || res.statusCode === 204) {
                delete res.headers["content-encoding"];
              }

              switch ((res.headers["content-encoding"] || "").toLowerCase()) {
                /*eslint default-case:0*/
                case "gzip":
                case "x-gzip":
                case "compress":
                case "x-compress":
                  // add the unzipper to the body stream processing pipeline
                  streams.push(zlib.createUnzip(zlibOptions));

                  // remove the content-encoding in order to not confuse downstream operations
                  delete res.headers["content-encoding"];
                  break;
                case "deflate":
                  streams.push(new ZlibHeaderTransformStream());

                  // add the unzipper to the body stream processing pipeline
                  streams.push(zlib.createUnzip(zlibOptions));

                  // remove the content-encoding in order to not confuse downstream operations
                  delete res.headers["content-encoding"];
                  break;
                case "br":
                  if (isBrotliSupported) {
                    streams.push(zlib.createBrotliDecompress(brotliOptions));
                    delete res.headers["content-encoding"];
                  }
              }
            }

            responseStream =
              streams.length > 1
                ? stream.pipeline(streams, utils.noop)
                : streams[0];

            const offListeners = stream.finished(responseStream, () => {
              offListeners();
              onFinished();
            });

            const response = {
              status: res.statusCode,
              statusText: res.statusMessage,
              headers: new AxiosHeaders(res.headers),
              config,
              request: lastRequest,
            };

            if (responseType === "stream") {
              response.data = responseStream;
              settle(resolve, reject, response);
            } else {
              const responseBuffer = [];
              let totalResponseBytes = 0;

              responseStream.on("data", function handleStreamData(chunk) {
                responseBuffer.push(chunk);
                totalResponseBytes += chunk.length;

                // make sure the content length is not over the maxContentLength if specified
                if (
                  config.maxContentLength > -1 &&
                  totalResponseBytes > config.maxContentLength
                ) {
                  // stream.destroy() emit aborted event before calling reject() on Node.js v16
                  rejected = true;
                  responseStream.destroy();
                  reject(
                    new AxiosError(
                      "maxContentLength size of " +
                        config.maxContentLength +
                        " exceeded",
                      AxiosError.ERR_BAD_RESPONSE,
                      config,
                      lastRequest,
                    ),
                  );
                }
              });

              responseStream.on("aborted", function handlerStreamAborted() {
                if (rejected) {
                  return;
                }

                const err = new AxiosError(
                  "maxContentLength size of " +
                    config.maxContentLength +
                    " exceeded",
                  AxiosError.ERR_BAD_RESPONSE,
                  config,
                  lastRequest,
                );
                responseStream.destroy(err);
                reject(err);
              });

              responseStream.on("error", function handleStreamError(err) {
                if (res.raw.req.destroyed) return;
                reject(AxiosError.from(err, null, config, lastRequest));
              });

              responseStream.on("end", function handleStreamEnd() {
                try {
                  let responseData =
                    responseBuffer.length === 1
                      ? responseBuffer[0]
                      : Buffer.concat(responseBuffer);
                  if (responseType !== "arraybuffer") {
                    responseData = responseData.toString(responseEncoding);
                    if (!responseEncoding || responseEncoding === "utf8") {
                      responseData = utils.stripBOM(responseData);
                    }
                  }
                  response.data = responseData;
                } catch (err) {
                  return reject(
                    AxiosError.from(
                      err,
                      null,
                      config,
                      response.request,
                      response,
                    ),
                  );
                }
                settle(resolve, reject, response);
              });
            }

            emitter.once("abort", (err) => {
              if (!responseStream.destroyed) {
                responseStream.emit("error", err);
                responseStream.destroy();
              }
            });
          },
        );

        emitter.once("abort", (err) => {
          reject(err);
        });

        // Handle request timeout
        if (config.timeout) {
          // This is forcing a int timeout to avoid problems if the `req` interface doesn't handle other types.
          timeout = parseInt(config.timeout, 10);

          if (Number.isNaN(timeout)) {
            reject(
              new AxiosError(
                "error trying to parse `config.timeout` to int",
                AxiosError.ERR_BAD_OPTION_VALUE,
                config,
                // res.raw.req,
              ),
            );

            return;
          }

          // Sometime, the response will be very slow, and does not respond, the connect event will be block by event loop system.
          // And timer callback will be fired, and abort() will be invoked before connection, then get "socket hang up" and code ECONNRESET.
          // At this time, if we have a large number of request, nodejs will hang up some socket on background. and the number will up and up.
          // And then these socket which be hang up will devouring CPU little by little.
          // ClientRequest.setTimeout will be fired on the specify milliseconds, and can make sure that abort() will be fired after connect.
          setTimeout(function handleRequestTimeout() {
            if (isDone) return;
            let timeoutErrorMessage = config.timeout
              ? "timeout of " + config.timeout + "ms exceeded"
              : "timeout exceeded";
            const transitional = config.transitional || transitionalDefaults;
            if (config.timeoutErrorMessage) {
              timeoutErrorMessage = config.timeoutErrorMessage;
            }
            reject(
              new AxiosError(
                timeoutErrorMessage,
                transitional.clarifyTimeoutError
                  ? AxiosError.ETIMEDOUT
                  : AxiosError.ECONNABORTED,
                config,
                // req,
              ),
            );
            abort();
          }, timeout);
        }

        if (config.cancelToken || config.signal) {
          // Handle cancellation
          const onCanceled = (cancel) => {
            if (controller.signal.aborted) return;

            controller.abort();
            reject(
              !cancel || (cancel && cancel.type) ? new CanceledError() : cancel,
            );
          };

          config.cancelToken && config.cancelToken.subscribe(onCanceled);
          if (config.signal) {
            config.signal.aborted
              ? onCanceled()
              : config.signal.addEventListener("abort", onCanceled);
          }
        }
      },
    );
  };
}

export function createLightMyRequestAdapterFromFastify(instance, opts = {}) {
  return createLightMyRequestAdapter((req, res) => {
    instance.ready((err) => {
      if (err) {
        res.emit("error", err);
        return;
      }
      instance.routing(req, res);
    });
  }, opts);
}
