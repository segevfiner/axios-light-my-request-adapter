import { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import * as utils from "./axios-utils";

export function axiosErrorFrom(
  error: Error,
  code: string | null,
  config: AxiosRequestConfig,
  request: unknown,
  response?: AxiosResponse,
  customProps?: object
) {
  const axiosError = Object.create(AxiosError.prototype);

  utils.toFlatObject(
    error as unknown as Record<string, unknown>,
    axiosError,
    function filter(obj: object) {
      return obj !== Error.prototype;
    }
  );

  AxiosError.call(
    axiosError,
    error.message,
    code ?? undefined,
    config,
    request,
    response
  );

  axiosError.name = error.name;

  customProps && Object.assign(axiosError, customProps);

  return axiosError;
}
