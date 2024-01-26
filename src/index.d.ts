import http from "http";
import { DispatchFunc } from "light-my-request";
import { AxiosAdapter } from "axios";
import { FastifyInstance } from "fastify";

export interface LightMyRequestAdapterOptions {
  /** Optional http server. It is used for binding the `dispatchFunc` */
  server?: http.Server;

  /** an optional string specifying the client remote address. Defaults to '127.0.0.1' */
  remoteAddress?: string;
}

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
): AxiosAdapter;

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
): AxiosAdapter;
