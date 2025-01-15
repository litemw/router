import { describe, expect, mock, test } from 'bun:test';
import Koa from 'koa';
import { createRouter } from '../../lib';
import request from 'supertest';
import { flatten } from 'lodash-es';

const port = 8080;

describe('Basic HTTP server methods responses', () => {
  const callback = mock((method: string) => void 0);

  const router = createRouter('/api');

  router.get('/endpoint').use((ctx, next) => {
    callback('get');
  });

  router.post('/endpoint').use((ctx, next) => {
    callback('post');
  });

  router.put('/endpoint').use((ctx, next) => {
    callback('put');
  });

  router.del('/endpoint').use((ctx, next) => {
    callback('delete');
  });

  router.patch('/endpoint').use((ctx, next) => {
    callback('patch');
  });

  router.head('/others').use((ctx, next) => {
    callback('head');
  });

  router.options('/others').use((ctx, next) => {
    callback('options');
  });

  router.link('/others').use((ctx, next) => {
    callback('link');
  });

  router.unlink('/others').use((ctx, next) => {
    callback('unlink');
  });

  router.all('/all').use((ctx, next) => {
    callback(ctx.method.toLowerCase());
  });

  const app = new Koa();
  // Supertest requests link/unlink in lower cases
  app.use((ctx, next) => {
    ctx.method = ctx.method.toUpperCase();
    return next();
  });
  app.use(router.routes());
  const server = app.listen(port);

  const baseMethods = [
    'get',
    'post',
    'put',
    'delete',
    'patch',
  ] as const satisfies string[];

  const otherMethods = [
    'head',
    'options',
    'link',
    'unlink',
  ] as const satisfies string[];

  test.each(baseMethods)('Method %p', async (method) => {
    callback.mockClear();
    await new Promise<void>((resolve, reject) => {
      request(server)[method]('/api/endpoint').end(resolve);
    });

    expect(callback).toHaveBeenNthCalledWith(1, method);
  });

  test.each(otherMethods)('Other methods: %p', async (method) => {
    callback.mockClear();
    await new Promise<void>((resolve, reject) => {
      request(server)
        [method]('/api/others')
        .end((err, res) => {
          resolve();
        });
    });

    expect(callback).toHaveBeenNthCalledWith(1, method);
  });

  test('All methods', async () => {
    callback.mockClear();
    const methods = [...baseMethods, ...otherMethods];
    await Promise.all(
      methods.map((method) => {
        return new Promise<void>((resolve, reject) => {
          request(server)
            [method]('/api/all')
            .end((err, res) => {
              resolve();
            });
        });
      }),
    );

    expect(callback).toHaveBeenCalledTimes(methods.length);
    expect(new Set(...flatten(callback.mock.calls))).toEqual(
      new Set(...methods),
    );
  });
});
