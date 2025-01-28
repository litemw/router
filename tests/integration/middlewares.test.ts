import { describe, expect, mock, test } from 'bun:test';
import Koa from 'koa';
import { createRouter } from '../../lib';
import request from 'supertest';
import { clone } from 'lodash-es';

const port = 8081;

describe('Middlewares test', async () => {
  const callback = mock((...args: any[]) => void 0);

  const routerData1 = { rd1: 'some router data' } as const,
    routerData2 = { rd2: ['array ', 'data'] } as const,
    handlerData1 = { hd1: 'some handler data' } as const,
    handlerData2 = { hd2: { inner: 'inner data' } } as const;

  const router = createRouter('/api')
    .use((ctx, next) => {
      callback(clone(ctx.state));
      return routerData1;
    })
    .use((ctx, next) => {
      callback(clone(ctx.state));
      return routerData2;
    });

  const handler = router
    .get('/endpoint')
    .use((ctx, next) => {
      callback(clone(ctx.state));
      return handlerData1;
    })
    .use((ctx, next) => {
      callback(clone(ctx.state));
      return handlerData2;
    })
    .use((ctx, next) => {
      callback(clone(ctx.state));
      ctx.body = 'Server response';
    });

  const app = new Koa();
  app.use(router.routes());
  const server = app.listen(port);

  await new Promise<void>((resolve, reject) => {
    request(server)
      .get('/api/endpoint')
      .expect(200, 'Server response')
      .end((err, res) => {
        if (err) {
          reject(err);
        }
        resolve();
      });
  });

  expect(callback.mock.calls.length).toBe(5);

  test('Router middlewares', () => {
    expect(callback).toHaveBeenNthCalledWith(1, { router });
    expect(callback).toHaveBeenNthCalledWith(2, { router, ...routerData1 });
  });

  test('Handler middlewares', () => {
    expect(callback).toHaveBeenNthCalledWith(3, {
      router,
      ...routerData1,
      ...routerData2,
      handler,
    });
    expect(callback).toHaveBeenNthCalledWith(4, {
      router,
      ...routerData1,
      ...routerData2,
      handler,
      ...handlerData1,
    });
    expect(callback).toHaveBeenNthCalledWith(5, {
      router,
      ...routerData1,
      ...routerData2,
      handler,
      ...handlerData1,
      ...handlerData2,
    });
  });
});
