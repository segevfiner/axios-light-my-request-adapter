import { AxiosError, AxiosRequestConfig, AxiosResponse, Cancel } from "axios";
import { DispatchFunc, inject, InjectOptions } from "light-my-request";
import url from "url";
import { buildFullPath } from "./axios-core";
import { buildURL } from "./axios-helpers";
import * as utils from "./axios-utils";
import http from "http";

const isHttps = /https:?/;

export default function createLightMyRequestAdapter(dispatchFunc: DispatchFunc) {
  return function lightMyRequestAdapter<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return new Promise((resolvePromise, rejectPromise) => {
      let onCanceled: () => void;
      function done() {
        if (config.cancelToken) {
          (config.cancelToken as unknown as CancelToken).unsubscribe(onCanceled);
        }

        if (config.signal) {
          (config.signal as MyAbortSignal).removeEventListener("abort", onCanceled);
        }
      }
      function resolve(value: AxiosResponse<T>) {
        done();
        resolvePromise(value);
      }
      let rejected = false;
      function reject(value: unknown) {
        done();
        rejected = true;
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
        if (config.maxBodyLength && config.maxBodyLength > -1 && data.length > config.maxBodyLength) {
          return reject(new AxiosError(
            "Request body larger than maxBodyLength limit",
            AxiosError.ERR_BAD_REQUEST,
            config
          ));
        }
      }

      // HTTP basic authentication
      let auth = undefined;
      if (config.auth) {
        const username = config.auth.username || '';
        const password = config.auth.password || '';
        auth = username + ':' + password;
      }

      // Parse url
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const fullPath = buildFullPath(config.baseURL, config.url!);
      const parsed = url.parse(fullPath);
      const protocol = parsed.protocol || "http:";

      if (!auth && parsed.auth) {
        const urlAuth = parsed.auth.split(':');
        const urlUsername = urlAuth[0] || '';
        const urlPassword = urlAuth[1] || '';
        auth = urlUsername + ':' + urlPassword;
      }

      if (auth) {
        if (headerNames.authorization) {
          delete headers[headerNames.authorization];
        }
        headers.authorization = "Basic " + Buffer.from(auth).toString("base64");
      }

      const isHttpsRequest = isHttps.test(protocol);
      const agent = isHttpsRequest ? config.httpsAgent : config.httpAgent;

      let builtUrl;
      try {
        // TODO We need the path and params separated
        builtUrl = buildURL(parsed.path ?? "", config.params, config.paramsSerializer).replace(/^\?/, '');
      } catch (err) {
        const customErr: Error & {config?: AxiosRequestConfig, url?: string, exists?: boolean} = new Error((err as Error).message);
        customErr.config = config;
        customErr.url = config.url;
        customErr.exists = true;
        reject(customErr);
        return;
      }

      inject(dispatchFunc, {
        url: {
          pathname: parsed.path ?? "",
          hostname: parsed.hostname ?? undefined,
          port: parsed.port ?? undefined,
          protocol: protocol,
          // query: query,
        },
        method: config.method as InjectOptions['method'],
        headers: headers as http.OutgoingHttpHeaders,
        payload: config.data,
      }, (err, response) => {
        if (err) {
          reject(err);
        }
      });
    });
  }
}

interface CancelToken {
    subscribe(listener: (reason: Cancel) => void): void;
    unsubscribe(listener: (reason: Cancel) => void): void;
  }

interface MyAbortSignal extends AbortSignal {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}
