# axios Light my Request Adapter

[![CI](https://github.com/segevfiner/axios-light-my-request-adapter/actions/workflows/ci.yml/badge.svg)](https://github.com/segevfiner/axios-light-my-request-adapter/actions/workflows/ci.yml)
[![Docs](https://github.com/segevfiner/axios-light-my-request-adapter/actions/workflows/docs.yml/badge.svg)](https://segevfiner.github.io/axios-light-my-request-adapter/)

This can be used to wire an axios based client to a server during testing using Light my Request.

## Getting Started

```js
const axios = require("axios");
const {
  createLightMyRequestAdapter,
} = require("axios-light-my-request-adapter");

function dispatch(req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ data: "Hello World!" }));
}

const instance = axios.create({
  baseURL: "http://localhost/",
  adapter: createLightMyRequestAdapter(dispatch),
});

(async function () {
  const res = await instance.get("/");
  console.log(res);
})();
```

Or with [Fastify](https://www.fastify.io/):

```js
const axios = require("axios");
const fastify = require("fastify");
const {
  createLightMyRequestAdapterFromFastify,
} = require("axios-light-my-request-adapter");

const app = fastify();
app.get("/", async () => {
  return { data: "Hello World!" };
});

const instance = axios.create({
  baseURL: "http://localhost/",
  adapter: createLightMyRequestAdapterFromFastify(app),
});

(async function () {
  const res = await instance.get("/");
  console.log(res);
})();
```

## Caveats

- `maxRedirects`, `socketPath`, and `proxy` are not
- `decompress` is ignored as Light my Request doesn't support that cleanly. It shoudln't pass
  `Accept-Encoding` anyhow.

## License

MIT.

Some code was taken from [axios](https://github.com/axios/axios), see [NOTICE](NOTICE)
