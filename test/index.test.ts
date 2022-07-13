import axios, { Axios } from "axios";
import http from "http";
import stream from 'stream'
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

describe('Light my Request adapter', () => {
  const dispatch = jest.fn<void, Parameters<http.RequestListener>>();
  let instance: Axios;

  beforeEach(() => {
    instance = axios.create({
      baseURL: "http://localhost/",
      adapter: createLightMyRequestAdapter(dispatch as unknown as DispatchFunc),
    });
  })

  test('request body', async () => {
    dispatch.mockImplementationOnce(async (req, res) => {
      const body: {name?: string} = JSON.parse(await stream.promises.pipeline(req, async function (source) {
        (source as stream.Readable).setEncoding('utf8');
        const chunks = [];
        for await (const chunk of source) {
          chunks.push(chunk);
        }
        return chunks.join();
      }));


      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: `Hello ${body.name}!` }));
    })

    const res = await instance.post("/", {name: "World"});
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      "content-type": "application/json",
    });
    expect(res.data).toMatchObject({ data: "Hello World!" });
  })
});
