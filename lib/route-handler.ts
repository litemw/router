import { Router } from './router';
import {
  MethodsType,
  Rewrite,
  toKoaMiddleware,
  Middleware,
  MetaKeys,
} from './core';
import 'reflect-metadata';
import * as _ from 'lodash-es';

/**
 * Type of route handler, it can chain middlewares with `use` method
 * @typeParam Path - path of route handler
 * @typeParam Method - method of route handler
 * @typeParam RouterPrefix - prefix path of parents router
 * @typeParam State - type of current ctx.state
 * @typeParam RouterState - type of parents router state
 */
export type RouteHandler<
  Path extends string = string,
  Method extends MethodsType = MethodsType,
  RouterPrefix extends string = string,
  State = {},
  RouterState = {},
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

  metadata?: any;

  /**
   * Add middleware (with/or metadata) to chain
   * @param mw - middleware or metadata
   */
  use<NewState extends State, Return>(
    mw: Middleware<NewState, Return>,
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
    use(mw: Middleware) {
      if (_.isFunction(mw[MetaKeys.metaCallback])) {
        mw[MetaKeys.metaCallback](this.router, this);
      }
      if (!mw[MetaKeys.ignoreMiddleware] && _.isFunction(mw)) {
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
