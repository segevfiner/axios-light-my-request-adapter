# axios Light my Request Adapter
This can be used to wire an axios based client to a server during testing using Light my Request.

## Getting Started
```js
const axios = require("axios");
const axiosLightMyRequestAdapter = require(".").default;

function dispatch(req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ data: "Hello World!" }));
}

const instance = axios.create({
  baseURL: "http://localhost/",
  adapter: axiosLightMyRequestAdapter(dispatch),
});

(async function () {
  const res = await instance.get("/");
  console.log(res);
})();
```
