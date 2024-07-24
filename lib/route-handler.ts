import { Router } from './router';
import {
  MethodsType,
  Rewrite,
  toKoaMiddleware,
  MetaKeys,
  MiddlewareOrMeta,
  MetaKeyValues,
} from './core';
import 'reflect-metadata';
import { isFunction } from 'lodash';

/**
 * Type of route handler, it can chain middlewares with `use` method
 * @typeParam Path - path of route handler
 * @typeParam Method - method of route handler
 * @typeParam RouterPrefix - prefix path of parents router
 * @typeParam State - type of current ctx.state
 * @typeParam RouterState - type of parents router state
 */
export type RouteHandler<
  Path extends string,
  Method extends MethodsType,
  RouterPrefix extends string,
  State = unknown,
  RouterState = unknown,
> = {
  /**
   * Parent router
   */
  readonly router: Router<RouterPrefix, Method, RouterState>;

  /**
   * Endpoint method
   */
  readonly method: Method;

  /**
   * Endpoint relative path
   */
  readonly path: string;

  /**
   * Handler name
   */
  readonly name?: string;

  /**
   * Add middleware (with/or metadata) to chain
   * @param mw - middleware or metadata
   */
  use<NewState extends State, Return>(
    mw: MiddlewareOrMeta<NewState, Return>,
  ): RouteHandler<
    Path,
    Method,
    RouterPrefix,
    Rewrite<State, Return>,
    RouterState
  >;
};

/**
 * Creates route handler
 * @param router - parent router
 * @param method - endpoint method
 * @param path - endpoint path
 * @param name - handler name
 * @return chainable route handler
 */
export function createRouteHandler<
  const Path extends string,
  const Prefix extends string,
  const Method extends MethodsType,
  const State = unknown,
>(
  router: Router<Prefix, Method, State>,
  method: Method,
  path: Path,
  name?: string,
): RouteHandler<Path, Method, Prefix, State, State> {
  return {
    path,
    method,
    name,
    router,
    use(mw: MiddlewareOrMeta) {
      if (!Reflect.getMetadata(MetaKeys.ignoreMeta, mw)) {
        Reflect.getMetadataKeys(mw)
          .filter((key) => MetaKeyValues.includes(key))
          .forEach((key) =>
            Reflect.defineMetadata(key, Reflect.getMetadata(key, mw), this),
          );
      }
      if (!Reflect.getMetadata(MetaKeys.metaOnly, mw) && isFunction(mw)) {
        if (name) {
          this.router.koaRouter[method](name, path, toKoaMiddleware(mw));
        } else {
          this.router.koaRouter[method](path, toKoaMiddleware(mw));
        }
      }
      return this;
    },
  };
}
