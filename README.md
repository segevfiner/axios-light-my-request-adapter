# axios Light my Request Adapter

[![CI](https://github.com/segevfiner/axios-light-my-request-adapter/actions/workflows/ci.yml/badge.svg)](https://github.com/segevfiner/axios-light-my-request-adapter/actions/workflows/ci.yml)
[![Docs](https://github.com/segevfiner/axios-light-my-request-adapter/actions/workflows/docs.yml/badge.svg)](https://segevfiner.github.io/axios-light-my-request-adapter/)

This can be used to wire an Axios based client to a server during testing using Light my Request. Requires `axios@^1`.

[Documentation](https://segevfiner.github.io/axios-light-my-request-adapter/)

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

- `maxRedirects` is not supported https://github.com/fastify/light-my-request/issues/209, and will throw.
- `socketPath` and `proxy` are not supported and will throw.
- `httpAgent` & `httpsAgent` are ignored.

## License

MIT.

Some code was taken from [axios](https://github.com/axios/axios), see [NOTICE](NOTICE)
