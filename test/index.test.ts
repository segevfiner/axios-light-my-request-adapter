import { beforeEach, describe, expect, test, vi } from "vitest";
import axios, { Axios, AxiosError } from "axios";
import http from "http";
import stream from "stream";
import util from "util";
import fastify from "fastify";
import {
  createLightMyRequestAdapter,
  createLightMyRequestAdapterFromFastify,
} from "../src/index.js";
import { brotliCompress, gzip } from "zlib";

describe("Light my Request adapter with plain dispatch", () => {
  const dispatch = vi.fn<http.RequestListener>();
  let instance: InstanceType<typeof Axios>;

  beforeEach(() => {
    instance = axios.create({
      baseURL: "http://localhost/",
      adapter: createLightMyRequestAdapter(dispatch),
    });
  });

  test("hello world", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: "Hello World!" }));
    });

    const res = await instance.get("/");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("url", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: "Hello World!" }));
    });

    const res = await instance.get("/hello");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/hello" }),
      expect.any(http.ServerResponse),
    );
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("method", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: "Hello World!" }));
    });

    const res = await instance.post("/");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST" }),
      expect.any(http.ServerResponse),
    );
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("Host header", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: "Hello World!" }));
    });

    const res = await instance.post("/");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ host: "localhost" }),
      }),
      expect.any(http.ServerResponse),
    );
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("headers", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: `Hello ${req.headers["x-name"] as string}!`,
        }),
      );
    });

    const res = await instance.get("/", { headers: { "X-Name": "World" } });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("params", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      const url = new URL(
        req.url!,
        `http://${req.headers.host ?? "undefined"}`,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: `Hello ${url.searchParams.get("name") ?? ""}!`,
        }),
      );
    });

    const res = await instance.get("/", { params: { name: "World" } });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("data", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      (async () => {
        const body: { name?: string } = JSON.parse(
          await stream.promises.pipeline(req, async function (source) {
            (source as stream.Readable).setEncoding("utf8");
            const chunks = [];
            for await (const chunk of source) {
              chunks.push(chunk);
            }
            return chunks.join();
          }),
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: `Hello ${body.name ?? "undefined"}!` }));
      })().catch((reason) => res.destroy(reason as Error));
    });

    const res = await instance.post("/", { name: "World" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("auth", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: `Hello World!` }));
    });

    const res = await instance.get("/", {
      auth: { username: "test", password: "123456" },
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Basic dGVzdDoxMjM0NTY=",
        }),
      }),
      expect.any(http.ServerResponse),
    );
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("auth in URL", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: `Hello World!` }));
    });

    const res = await instance.get("http://test:123456@localhost/");
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Basic dGVzdDoxMjM0NTY=",
        }),
      }),
      expect.any(http.ServerResponse),
    );
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("responseType arrayBuffer", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: `Hello World!` }));
    });

    const res = await instance.get("/", { responseType: "arraybuffer" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(res.data).toStrictEqual(Buffer.from('{"data":"Hello World!"}'));
  });

  test("responseType document", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: `Hello World!` }));
    });

    const res = await instance.get("/", { responseType: "document" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(res.data).toStrictEqual('{"data":"Hello World!"}');
  });

  test("responseType text", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Hello World!");
    });

    const res = await instance.get("/", { responseType: "text" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "text/plain",
    });
    expect(res.data).toStrictEqual("Hello World!");
  });

  test("responseType stream", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Hello World!");
    });

    const res = await instance.get("/", { responseType: "stream" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "text/plain",
    });

    await expect(
      stream.promises.pipeline(res.data, async (source) => {
        const chunks = [];
        for await (const chunk of source) {
          chunks.push(chunk);
        }
        return chunks.join();
      }),
    ).resolves.toBe("Hello World!");
  });

  test("maxContentLength", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Hello World!");
    });

    await expect(instance.get("/", { maxContentLength: 1 })).rejects.toThrow(
      AxiosError,
    );
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("maxBodyLength", async () => {
    await expect(
      instance.post("/", "Hello, World!", { maxBodyLength: 1 }),
    ).rejects.toThrow(AxiosError);
  });

  test("decompress gzip", async () => {
    dispatch.mockImplementationOnce(async (req, res) => {
      const data = "Hello World!";
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Content-Encoding": "gzip",
      });
      res.end(await util.promisify(gzip)(data));
    });

    const res = await instance.get("/");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "text/plain" });
    expect(res.data).toStrictEqual("Hello World!");
  });

  test("decompress brotli", async () => {
    dispatch.mockImplementationOnce(async (req, res) => {
      const data = "Hello World!";
      res.writeHead(200, {
        "Content-Type": "text/plain",
        "Content-Encoding": "br",
      });
      res.end(await util.promisify(brotliCompress)(data));
    });

    const res = await instance.get("/");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "text/plain" });
    expect(res.data).toStrictEqual("Hello World!");
  });

  test("Failed request", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(500);
      res.end();
    });

    await expect(instance.get("/")).rejects.toThrow(AxiosError);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("cancelToken", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      const timeout = setTimeout(() => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Hello World!");
      }, 5000);

      req.on("close", () => clearTimeout(timeout));
    });

    const source = axios.CancelToken.source();
    const promise = instance.get("/", { cancelToken: source.token });
    source.cancel();
    await expect(promise).rejects.toThrow(AxiosError);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("signal", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      const timeout = setTimeout(() => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Hello World!");
      }, 5000);

      req.on("close", () => clearTimeout(timeout));
    });

    const controller = new AbortController();
    const promise = instance.get("/", { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow(AxiosError);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("cancelToken and signal", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      const timeout = setTimeout(() => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Hello World!");
      }, 5000);

      req.on("close", () => clearTimeout(timeout));
    });

    const source = axios.CancelToken.source();
    const controller = new AbortController();
    const promise = instance.get("/", {
      cancelToken: source.token,
      signal: controller.signal,
    });
    controller.abort();
    await expect(promise).rejects.toThrow(AxiosError);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("timeout", async () => {
    vi.useFakeTimers();
    try {
      dispatch.mockImplementationOnce((req, res) => {
        const timeout = setTimeout(() => {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("Hello World!");
        }, 5000);

        req.on("close", () => clearTimeout(timeout));
      });

      const promise = instance.get("/", {
        timeout: 1000,
      });
      vi.runAllTimers();
      await expect(promise).rejects.toThrow(AxiosError);
      expect(dispatch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

test("fastify hello world", async () => {
  const app = fastify();
  app.get("/", async () => {
    return Promise.resolve({ data: "Hello World!" });
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
