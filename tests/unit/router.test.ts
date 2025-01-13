import { expect, test, mock, describe } from 'bun:test';
import {
  createRouter,
  MetaKeys,
  MethodsArray,
  MethodsType,
  Middleware,
  RouteHandler,
  Router,
} from '../../lib';
import * as tsafe from 'tsafe';
import KoaRouter from 'koa-router';

describe('Router', async () => {
  const koaRouterPropMock = mock((...args: unknown[]) => void 0);
  const koaRouterMock = mock((...args: unknown[]) => void 0);
  const koaRouter = new Proxy(
    {},
    {
      get(target: any, prop: string, receiver: any): any {
        koaRouterPropMock(prop);
        return (...args: any[]) => koaRouterMock(prop, ...args);
      },
    },
  );

  tsafe.assert(tsafe.is<KoaRouter>(koaRouter));

  const router = createRouter('/prefix');

  (router as any).koaRouter = koaRouter;

  test('Koa router delegations', () => {
    const _ = router.opts;
    router.allowedMethods({});
    router.match('path', 'method');
    router.middleware();
    router.route('name');
    router.routes();
    router.url('name', {});

    expect(koaRouterPropMock).toHaveBeenCalledTimes(7);
    expect(koaRouterMock).toHaveBeenCalledTimes(6);
    [
      ['allowedMethods', {}],
      ['match', 'path', 'method'],
      ['middleware'],
      ['route', 'name'],
      ['routes'],
      ['url', 'name', {}, undefined],
    ].forEach((args, i) =>
      expect(koaRouterMock).toHaveBeenNthCalledWith(i + 1, ...args),
    );
  });

  test('Router middlewares', async () => {
    koaRouterPropMock.mockClear();
    koaRouterMock.mockClear();

    const routerMeta = { changed1: 'router' };

    const metaMock = mock((router: Router, handler?: RouteHandler) => {
      router.metadata = routerMeta;
    });

    const fn: Middleware = () => void 0;
    fn[MetaKeys.metaCallback] = (...args) => metaMock(...args);

    router.use(fn);

    expect(metaMock).toHaveBeenCalledTimes(1);
    expect(metaMock).toHaveBeenCalledWith(router);

    expect(koaRouterMock).toHaveBeenCalledTimes(1);
    expect(koaRouterMock.mock.calls[0][0]).toBe('use');
    expect(koaRouterMock.mock.calls[0][1]).toBeFunction();
  });

  test('Nested routers', async () => {
    koaRouterPropMock.mockClear();
    koaRouterMock.mockClear();

    let nested = { routes: mock(() => 'ok') };
    tsafe.assert(tsafe.is<Router>(nested));

    router.use('/prefix', nested);

    expect(nested.routes).toHaveBeenCalledTimes(1);
    expect(koaRouterMock).toHaveBeenNthCalledWith(1, 'use', '/prefix', 'ok');

    koaRouterPropMock.mockClear();
    koaRouterMock.mockClear();

    nested = { routes: mock(() => 'ok') };
    tsafe.assert(tsafe.is<Router>(nested));

    router.use(nested);

    expect(nested.routes).toHaveBeenCalledTimes(1);
    expect(koaRouterMock).toHaveBeenNthCalledWith(1, 'use', 'ok');
  });

  test('Routes creation', () => {
    koaRouterPropMock.mockClear();
    koaRouterMock.mockClear();

    MethodsArray.forEach((m: MethodsType) => {
      const handler = (router[m] as any)('/prefix', 'name');
      expect(
        koaRouterMock.mock.calls[koaRouterMock.mock.calls.length - 1].slice(
          0,
          3,
        ),
      ).toEqual([m, 'name', '/prefix']);
      expect(router.routeHandlers[router.routeHandlers.length - 1]).toEqual(
        handler,
      );
    });
  });
});
