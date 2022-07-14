import {
  AxiosAdapter,
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosResponseHeaders,
  Cancel,
  CanceledError,
} from "axios";
import http from "http";
import { DispatchFunc, inject, InjectOptions } from "light-my-request";
import { Readable } from "stream";
import url from "url";
import { buildFullPath, settle } from "./axios-core";
import { axiosErrorFrom } from "./axios-error";
import { buildParams } from "./axios-helpers";
import * as utils from "./axios-utils";

export interface LightMyRequestAdapterOptions {
  server?: http.Server;
  remoteAddress?: string;
}

/**
 * Create an {@link AxiosAdapter} that will inject requests/responses into `dispatchFunc` via Light my Request.
 *
 * @param dispatchFunc - listener function. The same as you would pass to Http.createServer when making a node HTTP server.
 * @param opts - Additional options
 * @param opts.server - Optional http server. It is used for binding the dispatchFunc
 * @param opts.remoteAddress - an optional string specifying the client remote address. Defaults to '127.0.0.1'
 * @returns An {@link AxiosAdapter}
 */
export function createLightMyRequestAdapter(
  dispatchFunc: DispatchFunc,
  opts: LightMyRequestAdapterOptions = {}
): AxiosAdapter {
  return function lightMyRequestAdapter<T = unknown>(
    config: AxiosRequestConfig
  ): Promise<AxiosResponse<T>> {
    return new Promise((resolvePromise, rejectPromise) => {
      let onCanceled: (cancel?: MyCancel) => void;
      function done() {
        if (config.cancelToken) {
          (config.cancelToken as unknown as MyCancelToken).unsubscribe(
            onCanceled
          );
        }

        if (config.signal) {
          (config.signal as MyAbortSignal).removeEventListener(
            "abort",
            onCanceled
          );
        }
      }
      function resolve(
        value: AxiosResponse<T> | PromiseLike<AxiosResponse<T>>
      ) {
        done();
        resolvePromise(value);
      }
      function reject(value: unknown) {
        done();
        rejectPromise(value);
      }
      const data = config.data;
      const headers = config.headers ?? {};
      const headerNames: Record<string, string> = {};

      Object.keys(headers).forEach(function storeLowerName(name) {
        headerNames[name.toLowerCase()] = name;
      });

      // support for https://www.npmjs.com/package/form-data api
      if (utils.isFormData(data) && utils.isFunction(data.getHeaders)) {
        Object.assign(headers, data.getHeaders());
      } else if (data && !utils.isStream(data)) {
        if (
          config.maxBodyLength &&
          config.maxBodyLength > -1 &&
          data.length > config.maxBodyLength
        ) {
          return reject(
            new AxiosError(
              "Request body larger than maxBodyLength limit",
              AxiosError.ERR_BAD_REQUEST,
              config
            )
          );
        }
      }

      // HTTP basic authentication
      let auth = undefined;
      if (config.auth) {
        const username = config.auth.username || "";
        const password = config.auth.password || "";
        auth = username + ":" + password;
      }

      // Parse url
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const fullPath = buildFullPath(config.baseURL, config.url!);
      const parsed = url.parse(fullPath);

      if (!auth && parsed.auth) {
        const urlAuth = parsed.auth.split(":");
        const urlUsername = urlAuth[0] || "";
        const urlPassword = urlAuth[1] || "";
        auth = urlUsername + ":" + urlPassword;
      }

      if (auth) {
        if (headerNames.authorization) {
          delete headers[headerNames.authorization];
        }
        headers.authorization = "Basic " + Buffer.from(auth).toString("base64");
      }

      try {
        const params = buildParams(config.params, config.paramsSerializer).replace(
          /^\?/,
          ""
        );
        if (parsed.search != null) {
          parsed.search += "&" + params;
        } else {
          parsed.search = params;
        }
      } catch (err) {
        const customErr: Error & {
          config?: AxiosRequestConfig;
          url?: string;
          exists?: boolean;
        } = new Error((err as Error).message);
        customErr.config = config;
        customErr.url = config.url;
        customErr.exists = true;
        reject(customErr);
        return;
      }

      if (config.socketPath) {
        reject(new Error("socketPath not supported"));
        return;
      }

      if (config.proxy != null) {
        reject(new Error("proxy not supported"));
        return;
      }

      let aborted = false;
      inject(
        dispatchFunc,
        {
          url: url.format(parsed),
          method: config.method?.toUpperCase() as
            | InjectOptions["method"]
            | undefined,
          headers: headers as http.OutgoingHttpHeaders,
          payload: config.data,
          server: opts.server,
          remoteAddress: opts.remoteAddress,
        },
        (err, res) => {
          if (aborted) return;

          if (err) {
            reject(axiosErrorFrom(err, null, config, res.raw.req));
          }

          const response: AxiosResponse = {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers as AxiosResponseHeaders,
            config: config,
            request: res.raw.req,
            data: undefined,
          };

          if (config.responseType === "stream") {
            const responseData = new Readable();
            responseData.push(res.body);
            responseData.push(null);
            response.data = responseData;
            settle(resolve, reject, response);
          } else {
            try {
              if (config.responseType === "arraybuffer") {
                response.data = Buffer.from(res.body);
              } else {
                let responseData = res.body;
                if (
                  !config.responseEncoding ||
                  config.responseEncoding === "utf8"
                ) {
                  responseData = utils.stripBOM(responseData);
                }
                response.data = responseData;
              }
            } catch (err) {
              reject(
                axiosErrorFrom(
                  err as Error,
                  null,
                  config,
                  response.request,
                  response
                )
              );
            }
            settle(resolve, reject, response);
          }
        }
      );

      if (config.cancelToken || config.signal) {
        // Handle cancellation
        onCanceled = function (cancel?: MyCancel) {
          if (aborted) return;

          aborted = true;
          reject(
            !cancel || (cancel && cancel.type) ? new CanceledError() : cancel
          );
        };

        config.cancelToken &&
          (config.cancelToken as unknown as MyCancelToken).subscribe(
            onCanceled
          );
        if (config.signal) {
          config.signal.aborted
            ? onCanceled()
            : (config.signal as MyAbortSignal).addEventListener(
                "abort",
                onCanceled
              );
        }
      }
    });
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

interface FastifyInstance {
  routing(req: unknown, res: unknown): void;
  ready(readyListener: (err: Error) => void): FastifyInstance;
}

export function createLightMyRequestAdapterFromFastify(
  instance: FastifyInstance,
  opts: LightMyRequestAdapterOptions = {}
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
