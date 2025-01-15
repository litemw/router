import { expect, test, mock, describe } from 'bun:test';
import {
  createRouteHandler,
  MetaKeys,
  MethodsArray,
  MethodsType,
  Middleware,
  RouteHandler,
  Router,
} from '../../lib';
import * as tsafe from 'tsafe';
import { isString } from 'lodash-es';

describe('Route handler', () => {
  const methodsMock = mock((...args: unknown[]) => void 0);
  const router = {
    koaRouter: new Proxy(
      {},
      {
        get(target: any, prop: string, receiver: any): any {
          if (
            isString(prop) &&
            tsafe.typeGuard<MethodsType>(
              prop,
              MethodsArray.includes(prop as any),
            )
          ) {
            return (...args: any[]) => methodsMock(prop, ...args);
          }
        },
      },
    ),
  };

  tsafe.assert(tsafe.is<Router<'prefix', MethodsType>>(router));

  const method = 'get',
    path = '/path',
    name = 'name';

  const handler = createRouteHandler(router, method, path, name);

  test('Has correct properties', () => {
    expect(handler.name).toEqual(name);
    expect(handler.path).toEqual(path);
    expect(handler.method).toEqual(method);
    expect(handler.metadata).toBeUndefined();
  });

  test.each(MethodsArray)('Method %s registration', (method: MethodsType) => {
    methodsMock.mockClear();

    const handler = createRouteHandler(router, method, path, name);
    expect(handler.method).toEqual(method);

    const fn = () => void 0;
    handler.use(fn);

    expect(methodsMock).toHaveBeenCalledTimes(1);

    const callRes = methodsMock.mock.calls[0];
    expect(callRes).toHaveLength(4);
    expect(callRes.slice(0, 3)).toEqual([method, name, path]);
    expect(callRes[3]).toBeFunction();
  });

  test('Ignoring middleware', () => {
    methodsMock.mockClear();
    const fn: Middleware = () => void 0;
    fn[MetaKeys.ignoreMiddleware] = true;
    handler.use(fn);
    expect(methodsMock).toHaveBeenCalledTimes(0);
  });

  test('Meta only middleware', () => {
    methodsMock.mockClear();

    const routerMeta = { changed1: 'router' },
      handlerMeta = { changed2: 'handler' };

    const metaMock = mock((router: Router, handler?: RouteHandler) => {
      router.metadata = routerMeta;
      if (handler) handler.metadata = handlerMeta;
    });

    const fn: Middleware = () => void 0;
    fn[MetaKeys.ignoreMiddleware] = true;
    fn[MetaKeys.metaCallback] = (...args) => metaMock(...args);
    handler.use(fn);

    expect(methodsMock).toHaveBeenCalledTimes(0);
    expect(metaMock).toHaveBeenNthCalledWith(1, router, handler);
    expect(router.metadata).toEqual(routerMeta);
    expect(handler.metadata).toEqual(handlerMeta);
  });

  test('Hybrid middleware registration', () => {
    methodsMock.mockClear();
    const metaMock = mock((router: Router, handler?: RouteHandler) => void 0);

    const fn: Middleware = () => void 0;
    fn[MetaKeys.metaCallback] = (...args) => metaMock(...args);

    handler.use(fn);

    expect(methodsMock).toHaveBeenCalledTimes(1);
    expect(metaMock).toHaveBeenNthCalledWith(1, router, handler);

    const callRes = methodsMock.mock.calls[0];
    expect(callRes).toHaveLength(4);
    expect(callRes.slice(0, 3)).toEqual([method, name, path]);
    expect(callRes[3]).toBeFunction();
  });
});
