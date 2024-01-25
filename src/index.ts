import {
  AxiosAdapter,
  AxiosError,
  AxiosHeaders,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosResponseHeaders,
  Cancel,
  CanceledError,
  InternalAxiosRequestConfig,
  VERSION,
} from "axios";
import http from "http";
import { DispatchFunc, inject, InjectOptions } from "light-my-request";
import stream from "stream";
import url from "url";
import { buildFullPath, settle } from "./axios-core";
import { axiosErrorFrom } from "./axios-error";
import { buildParams } from "./axios-helpers";
import * as utils from "./axios-utils";
import EventEmitter from "events";

export interface LightMyRequestAdapterOptions {
  /** Optional http server. It is used for binding the `dispatchFunc` */
  server?: http.Server;

  /** an optional string specifying the client remote address. Defaults to '127.0.0.1' */
  remoteAddress?: string;
}

const supportedProtocols = ["http", "https", "file", "data"].map((protocol) => {
  return protocol + ":";
});

type DoneCb<T> = ((value: T | PromiseLike<T>, isRejected?: false) => void) &
  ((reason: any, isRejected: true) => void);

const wrapAsync = <T>(
  asyncExecutor: (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void,
    onDone: (cb: DoneCb<T>) => void,
  ) => Promise<void>,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    let onDone: DoneCb<T> | undefined;
    let isDone: boolean;

    const done: DoneCb<T> = (value, isRejected) => {
      if (isDone) return;
      isDone = true;
      // @ts-ignore
      onDone && onDone(value, isRejected);
    };

    const _resolve = (value: T | PromiseLike<T>) => {
      done(value);
      resolve(value);
    };

    const _reject = (reason?: any) => {
      done(reason, true);
      reject(reason);
    };

    asyncExecutor(
      _resolve,
      _reject,
      (onDoneHandler: DoneCb<T>) => (onDone = onDoneHandler),
    ).catch(_reject);
  });
};

/**
 * Create an `AxiosAdapter` that will inject requests/responses into `dispatchFunc` via Light my
 * Request.
 *
 * @param dispatchFunc - Listener function. The same as you would pass to `http.createServer` when
 *                       making a node HTTP server.
 * @param opts - Additional options
 * @returns An `AxiosAdapter`
 */
export function createLightMyRequestAdapter(
  dispatchFunc: DispatchFunc,
  opts: LightMyRequestAdapterOptions = {},
): AxiosAdapter {
  return function lightMyRequestAdapter<T = unknown>(
    config: InternalAxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return wrapAsync(
      async function dispatchHttpRequest(resolve, reject, onDone) {
        let { data, family } = config;
        const { responseType, responseEncoding } = config;
        const method = config.method!.toUpperCase();
        let isDone;
        let rejected = false;
        let req;

        // temporary internal emitter until the AxiosRequest class will be implemented
        const emitter = new EventEmitter();

        const onFinished = () => {
          if (config.cancelToken) {
            (config.cancelToken as unknown as MyCancelToken).unsubscribe(abort);
          }
          if (config.signal) {
            (config.signal as unknown as MyAbortSignal).removeEventListener(
              "abort",
              abort,
            );
          }
          emitter.removeAllListeners();
        };

        onDone((value, isRejected) => {
          isDone = true;
          if (isRejected) {
            rejected = true;
            onFinished();
          }
        });

        function abort(reason?: any) {
          emitter.emit(
            "abort",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            !reason || reason.type
              ? // @ts-ignore
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                new CanceledError(undefined, config, req)
              : reason,
          );
        }

        emitter.once("abort", reject);

        if (config.cancelToken || config.signal) {
          config.cancelToken &&
            (config.cancelToken as unknown as MyCancelToken).subscribe(abort);
          if (config.signal) {
            config.signal.aborted
              ? abort()
              : (config.signal as unknown as MyAbortSignal).addEventListener(
                  "abort",
                  abort,
                );
          }
        }

        // Parse url
        const fullPath = buildFullPath(config.baseURL, config.url!);
        const parsed = new URL(fullPath, "http://localhost");
        const protocol = parsed.protocol || supportedProtocols[0];

        if (protocol === "data:") {
          let convertedData: string | Buffer | stream.Readable;

          if (method !== "GET") {
            return settle(resolve, reject, {
              status: 405,
              statusText: "method not allowed",
              headers: {},
              config,
              data: undefined,
            });
          }

          try {
            convertedData = fromDataURI(config.url, responseType === "blob", {
              Blob: config.env && config.env.Blob,
            });
          } catch (err) {
            throw axiosErrorFrom(
              err as Error,
              AxiosError.ERR_BAD_REQUEST,
              config,
            );
          }

          if (responseType === "text") {
            convertedData = (convertedData as Buffer).toString(
              responseEncoding as BufferEncoding,
            );

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

        const headers = AxiosHeaders.from(config.headers).normalize(false);

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
            } catch (e) {}
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
      },
    );
  };
}

interface MyCancel extends Cancel {
  type?: string;
}

interface MyCancelToken {
  subscribe(listener: (reason: MyCancel) => void): void;
  unsubscribe(listener: (reason: MyCancel) => void): void;
}

interface MyAbortSignal extends AbortSignal {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/**
 * Simple interface for a `FastifyInstance` for {@link createLightMyRequestAdapterFromFastify}.
 */
export interface FastifyInstance {
  routing(req: unknown, res: unknown): void;
  ready(readyListener: (err: Error) => void): FastifyInstance;
}

/**
 * Create an `AxiosAdapter` that will inject requests/responses into the Fastify `instance` via
 * Light my Request.
 *
 * @param instance - A Fastify instance.
 * @param opts - Additional options
 * @returns An `AxiosAdapter`
 */
export function createLightMyRequestAdapterFromFastify(
  instance: FastifyInstance,
  opts: LightMyRequestAdapterOptions = {},
) {
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
