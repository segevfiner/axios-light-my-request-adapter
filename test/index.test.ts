import axios, { Axios } from "axios";
import http from "http";
import stream from "stream";
import fastify from "fastify";
import {
  createLightMyRequestAdapter,
  createLightMyRequestAdapterFromFastify,
} from "..";

describe("Light my Request adapter with plain dispatch", () => {
  const dispatch = jest.fn<void, Parameters<http.RequestListener>>();
  let instance: Axios;

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
    expect(dispatch).toBeCalledTimes(1);
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
    expect(dispatch).toBeCalledWith(
      expect.objectContaining({ url: "/hello" }),
      expect.any(http.ServerResponse)
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
    expect(dispatch).toBeCalledWith(
      expect.objectContaining({ method: "POST" }),
      expect.any(http.ServerResponse)
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
    expect(dispatch).toBeCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ host: "localhost:80" }),
      }),
      expect.any(http.ServerResponse)
    );
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("headers", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: `Hello ${req.headers["x-name"]}!` }));
    });

    const res = await instance.get("/", { headers: { "X-Name": "World" } });
    expect(dispatch).toBeCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("params", async () => {
    dispatch.mockImplementationOnce((req, res) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ data: `Hello ${url.searchParams.get("name") ?? ""}!` })
      );
    });

    const res = await instance.get("/", { params: { name: "World" } });
    expect(dispatch).toBeCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({ "content-type": "application/json" });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("data", async () => {
    dispatch.mockImplementationOnce(async (req, res) => {
      const body: { name?: string } = JSON.parse(
        await stream.promises.pipeline(req, async function (source) {
          (source as stream.Readable).setEncoding("utf8");
          const chunks = [];
          for await (const chunk of source) {
            chunks.push(chunk);
          }
          return chunks.join();
        })
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: `Hello ${body.name}!` }));
    });

    const res = await instance.post("/", { name: "World" });
    expect(dispatch).toBeCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("auth", async () => {
    dispatch.mockImplementationOnce(async (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: `Hello World!` }));
    });

    const res = await instance.get("/", {
      auth: { username: "test", password: "123456" },
    });
    expect(dispatch).toBeCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Basic dGVzdDoxMjM0NTY=",
        }),
      }),
      expect.any(http.ServerResponse)
    );
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("responseType arrayBuffer", async () => {
    dispatch.mockImplementationOnce(async (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: `Hello World!` }));
    });

    const res = await instance.get("/", { responseType: "arraybuffer" });
    expect(dispatch).toBeCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(res.data).toStrictEqual(Buffer.from('{"data":"Hello World!"}'));
  });

  test("responseType document", async () => {
    dispatch.mockImplementationOnce(async (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: `Hello World!` }));
    });

    const res = await instance.get("/", { responseType: "document" });
    expect(dispatch).toBeCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(res.data).toStrictEqual({ data: "Hello World!" });
  });

  test("responseType text", async () => {
    dispatch.mockImplementationOnce(async (req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Hello World!");
    });

    const res = await instance.get("/", { responseType: "text" });
    expect(dispatch).toBeCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "text/plain",
    });
    expect(res.data).toStrictEqual("Hello World!");
  });

  test("responseType stream", async () => {
    dispatch.mockImplementationOnce(async (req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Hello World!");
    });

    const res = await instance.get("/", { responseType: "stream" });
    expect(dispatch).toBeCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "text/plain",
    });

    await expect(stream.promises.pipeline(res.data, async (source) => {
      const chunks = [];
      for await (const chunk of source) {
        chunks.push(chunk);
      }
      return chunks.join();
    })).resolves.toBe("Hello World!")
  });
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
