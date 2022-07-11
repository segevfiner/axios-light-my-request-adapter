import axios from "axios";
import http from "http";
import fastify from "fastify";
import { DispatchFunc } from "light-my-request";
import {
  createLightMyRequestAdapter,
  createLightMyRequestAdapterFromFastify,
} from "..";

test("hello world", async () => {
  function dispatch(req: http.IncomingMessage, res: http.ServerResponse) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: "Hello World!" }));
  }

  const instance = axios.create({
    baseURL: "http://localhost/",
    adapter: createLightMyRequestAdapter(dispatch as unknown as DispatchFunc),
  });

  const res = await instance.get("/");
  expect(res.status).toBe(200);
  expect(res.headers).toMatchObject({ "content-type": "application/json" });
  expect(res.data).toMatchObject({ data: "Hello World!" });
});

test("fastify hello world", async () => {
  const app = fastify();
  app.get("/", async () => {
    return { data: "Hello World!" };
  });

  const instance = axios.create({
    baseURL: "http://localhost/",
    adapter: createLightMyRequestAdapterFromFastify(app),
  });

  const res = await instance.get("/");
  expect(res.status).toBe(200);
  expect(res.headers).toMatchObject({
    "content-type": "application/json; charset=utf-8",
  });
  expect(res.data).toMatchObject({ data: "Hello World!" });
});