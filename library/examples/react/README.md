# React examples

Frontend-track concepts, built around the **order line-item editor**: edit a pending order's lines (quantity,
remove, coupon, subtotal) and cancel it — the same `Order` the backend concepts use.

```sh
npm ci
npm test                               # every concept
npx vitest run tests/<concept>.test.tsx  # one concept
npm run typecheck
```

Node 22.10+. React 19, Vitest 3, Testing Library, jsdom.

`src/order-api.ts` is the shared in-memory stand-in for the order service API. Tests control it explicitly:
`holdResponses` + `release()` expose loading and race states, `failNext` fails one request.
Concepts import it; they never edit it (see `library/CONVENTIONS.md`).
