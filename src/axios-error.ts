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
  const axiosError = Object.create(AxiosError.prototype) as AxiosError;

  utils.toFlatObject(error, axiosError, function filter(obj) {
    return obj !== Error.prototype;
  });

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
