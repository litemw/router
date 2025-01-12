import KoaRouter from 'koa-router';
import {
  Middleware,
  MethodsType,
  Rewrite,
  toKoaMiddleware,
  MethodsArray,
} from './core';
import { createRouteHandler, RouteHandler } from './route-handler';
import * as _ from 'lodash-es';

/**
 * Interface for functions that create route handlers in router (get, put, post, delete, etc.)
 * @typeParam Prefix - prefix of router
 * @typeParam Method - available methods
 * @typeParam State - initial router state
 */
export type IRouterMethodFunction<
  Prefix extends string,
  Methods extends MethodsType,
  State = unknown,
> = {
  /**
   * Creates route handler with path
   * @param path - endpoint path
   * @return chainable route handler
   */
  [MethodName in Methods]: <Path extends string>(
    path: Path,
  ) => RouteHandler<
    `${Prefix}${Path}`,
    MethodName,
    Prefix,
    Rewrite<State, { handler: RouteHandler<Path, MethodName, Prefix> }>,
    State
  >;
} & {
  /**
   * Creates route handler with path and name
   * @param path - endpoint path
   * @param name - endpoint name
   * @return chainable route handler
   */
  [MethodName in Methods]: <Path extends string>(
    path: Path,
    name: string,
  ) => RouteHandler<
    `${Prefix}${Path}`,
    MethodName,
    Prefix,
    Rewrite<State, { handler: RouteHandler<Path, MethodName, Prefix> }>,
    State
  >;
} & {
  /**
   * Creates route handler with path, name and middleware
   * @param path - endpoint path
   * @param name - endpoint name
   * @param mw - optional initial middleware (it can be only one middleware without next chain)
   * @return chainable route handler
   */
  [MethodName in Methods]: <
    Path extends string,
    NewState extends Rewrite<
      State,
      { handler: RouteHandler<Path, MethodName, Prefix> }
    >,
    Return = unknown,
  >(
    path: Path,
    name: string,
    mw: Middleware<NewState, Return>,
  ) => RouteHandler<
    `${Prefix}${Path}`,
    MethodName,
    Prefix,
    Rewrite<
      Rewrite<State, { handler: RouteHandler<Path, MethodName, Prefix> }>,
      Return
    >,
    State
  >;
};

/**
 * Router options with generic prefix and methods
 */
export type RouterOptions<
  Prefix extends string = '',
  Methods extends MethodsType = MethodsType,
> = Omit<KoaRouter.IRouterOptions, 'prefix' | 'methods'> & {
  prefix?: Prefix;
  methods?: Methods[];
};

/**
 * Default koa router functions for delegating it to our router
 */
export type IBaseRouter = Pick<
  KoaRouter,
  'routes' | 'middleware' | 'allowedMethods' | 'route' | 'url' | 'match'
>;

/**
 * Router
 * @typeParam Prefix - router path prefix
 * @typeParam Methods - allowed methods
 * @typeParam State - type of ctx.state
 */
export type Router<
  Prefix extends string,
  Methods extends MethodsType,
  State = unknown,
> = IBaseRouter &
  IRouterMethodFunction<Prefix, Methods, State> & {
    /**
     * Router options
     */
    get opts(): RouterOptions<Prefix, Methods>;

    /**
     * Inner koa router
     */
    readonly koaRouter: KoaRouter;

    /**
     * Registred handlers
     */
    readonly routeHandlers: RouteHandler<
      string,
      MethodsType,
      Prefix,
      unknown,
      State
    >[];

    /**
     * Registred routers
     */
    readonly routers: Router<string, MethodsType>[];

    metadata?: any;

    /**
     * Adds middleware or metadata to chain (will be called before route handlers)
     * @param mw - middleware (with/or metadata)
     */
    use<NewState extends State, Return>(
      mw: Middleware<NewState, Return>,
    ): Router<Prefix, Methods, Rewrite<State, Return>>;

    /**
     * Use nested router
     * @param router - other router
     */
    use(router: Router<string, MethodsType>): Router<Prefix, Methods, State>;

    /**
     * Use nested router
     * @param path - mount path
     * @param router - other router
     */
    use(
      path: string,
      router: Router<string, MethodsType>,
    ): Router<Prefix, Methods, State>;
  };

/**
 * Create router
 * @typeParam Prefix - router prefix
 * @typeParam Method - allowed methods
 * @param opts - router options
 * @example
 * ```
 * const apiRouter = createRouter({ prefix: '/api', methods: ['get', 'post'] })
 *    .use((ctx) => ({ someDataFromRouter: 123 }));
 *
 * apiRouter.get('/get', (ctx) => {
 *    ctx.body = ctx.state.someDataFromRouter; // available data from router middlewares
 * });
 *
 * apiRouter.get('/post', (ctx) => {
 *    return { someDateFromRoute: 'string' };
 * })
 *  .use((ctx) => {
 *      ctx.body = ctx.state.someDateFromRoute; // available data from current route middlewares
 *  });
 *
 * apiRouter.delete(...) // will not compile, delete is not allowed method
 * ```
 */
export function createRouter<
  const Prefix extends string,
  const Method extends MethodsType,
>(
  opts?: RouterOptions<Prefix, Method>,
): Router<Prefix, Method, { router: Router<Prefix, Method> }> {
  const koaRouter = new KoaRouter(opts);
  const router = {
    koaRouter,
    get opts() {
      return this.koaRouter.opts;
    },

    allowedMethods(
      options?: KoaRouter.IRouterAllowedMethodsOptions,
    ): KoaRouter.IMiddleware {
      return this.koaRouter.allowedMethods(options);
    },
    match(path: string, method: string): KoaRouter.IRoutesMatch {
      return this.koaRouter.match(path, method);
    },
    middleware(): KoaRouter.IMiddleware {
      return this.koaRouter.middleware();
    },
    route(name: string): any {
      return this.koaRouter.route(name);
    },
    routes(): KoaRouter.IMiddleware<{}> {
      return this.koaRouter.routes();
    },
    url(name: string, params: any, options?: KoaRouter.IUrlOptionsQuery): any {
      return this.koaRouter.url(name, params, options);
    },

    routeHandlers: [],
    routers: [],

    ..._.fromPairs(
      (opts?.methods ?? MethodsArray).map((method: MethodsType) => [
        method,
        function (path: string, name?: string, mw?: Middleware) {
          const route = createRouteHandler(this, method, path, name);
          this.routeHandlers.push(route);
          route.use(() => ({
            handler: route,
          }));
          if (mw) route.use(mw);
          return route;
        },
      ]),
    ),

    use<Return, NewState>(
      mwOrPathOrRouter:
        | Middleware<NewState, Return>
        | string
        | Router<any, any>,
      router?: Router<any, any>,
    ) {
      if (_.isString(mwOrPathOrRouter)) {
        this.koaRouter.use(mwOrPathOrRouter, router?.routes());
      } else if (_.isFunction(mwOrPathOrRouter)) {
        const mw = mwOrPathOrRouter;
        if (_.isFunction(mw.metaCallback) && !mw.ignoreMeta) {
          mw.metaCallback(this.router, this);
        }
        if (!mw.ignoreMiddleware && _.isFunction(mw)) {
          this.koaRouter.use(toKoaMiddleware(mw));
        }
      } else {
        this.routers.push(mwOrPathOrRouter);
        this.koaRouter.use(mwOrPathOrRouter.routes());
      }

      return this;
    },
  };

  router.use(() => ({
    router,
  }));

  return router as unknown as Router<Prefix, Method>;
}
