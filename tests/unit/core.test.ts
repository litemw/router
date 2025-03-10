import { expect, test, mock, describe } from 'bun:test';
import { Middleware, toKoaMiddleware } from '../../lib';
import * as tsafe from 'tsafe';
import Koa from 'koa';
import KoaRouter from '@koa/router';

describe('toKoaMiddleware function', async () => {
  const basemw: Middleware = async (ctx, next) => {
    await next();
    await next();
    await next();
    return { test: 'string' };
  };
  const mw = toKoaMiddleware(basemw);

  test('Returns a function', () => {
    expect(mw).toBeFunction();
  });

  const ctx = { state: {} };
  const next = mock(() => void 0);

  tsafe.assert(
    tsafe.is<Koa.ParameterizedContext<{}, KoaRouter.RouterParamContext>>(ctx),
  );
  tsafe.assert(tsafe.is<Koa.Next>(next));

  await mw(ctx, next);

  test('State has changed properly', () => {
    tsafe.assert(tsafe.is<{ test: string }>(ctx.state));
    expect(ctx.state).toHaveProperty('test', 'string');
  });

  test('Next has called once', () => {
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('Next cancelling', async () => {
  const basemw: Middleware = async (ctx, next) => {
    next.cancel();
    return { test: 'string' };
  };
  const mw = toKoaMiddleware(basemw);

  test('Returns a function', () => {
    expect(mw).toBeFunction();
  });

  const ctx = { state: {} };
  const next = mock(() => void 0);

  tsafe.assert(
    tsafe.is<Koa.ParameterizedContext<{}, KoaRouter.RouterParamContext>>(ctx),
  );
  tsafe.assert(tsafe.is<Koa.Next>(next));

  await mw(ctx, next);

  test('State has changed properly', () => {
    tsafe.assert(tsafe.is<{ test: string }>(ctx.state));
    expect(ctx.state).toHaveProperty('test', 'string');
  });

  test('Next has node been called', () => {
    expect(next).toHaveBeenCalledTimes(0);
  });
});
