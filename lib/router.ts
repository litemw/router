import KoaRouter from 'koa-router';
import {
  Middleware,
  MethodsType,
  Rewrite,
  toKoaMiddleware,
  MethodsArray,
  MetaKeys,
} from './core';
import { createRouteHandler, RouteHandler } from './route-handler';
import { fromPairs, isFunction, isNil, isString } from 'lodash-es';

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
  Prefix extends string = string,
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
  Prefix extends string = string,
  Methods extends MethodsType = MethodsType,
  State = {},
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
    readonly routers: [string | null, Router][];

    metadata: Record<any, any>;

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
    use(router: Router): Router<Prefix, Methods, State>;

    /**
     * Use nested router
     * @param path - mount path
     * @param router - other router
     */
    use(path: string, router: Router): Router<Prefix, Methods, State>;
  };

/**
 * Creates a router without prefix
 * */
export function createRouter(): Router<'', MethodsType, { router: Router<''> }>;

/**
 * Creates a router with options
 * @param opts - router options
 * */
export function createRouter<
  const Prefix extends string,
  const Method extends MethodsType,
>(
  opts: RouterOptions<Prefix, Method>,
): Router<Prefix, Method, { router: Router<Prefix, Method> }>;

/**
 * Creates a router with prefix
 * @param prefix - router prefix
 * */
export function createRouter<const Prefix extends string>(
  prefix: Prefix,
): Router<Prefix, MethodsType, { router: Router<Prefix> }>;

/**
 * Creates a router with prefix and options
 * @param prefix - router prefix
 * @param opts - router options
 * */
export function createRouter<
  const Prefix extends string,
  const Method extends MethodsType,
>(
  prefix: Prefix,
  opts: Omit<RouterOptions<Prefix, Method>, 'prefix'>,
): Router<Prefix, Method, { router: Router<Prefix, Method> }>;

/**
 * Creates a router with prefix and/or options (same as koa router options)
 */
export function createRouter(
  optsOrPrefix?: string | RouterOptions,
  opts?: RouterOptions,
): any {
  let options = opts ?? {};
  if (isString(optsOrPrefix)) options.prefix = optsOrPrefix;
  else if (!isNil(optsOrPrefix)) options = optsOrPrefix;

  const koaRouter = new KoaRouter(options);
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
    metadata: {},

    ...fromPairs(
      (options?.methods ?? MethodsArray).map((method: MethodsType) => [
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
      mwOrPathOrRouter: Middleware<NewState, Return> | string | Router,
      router?: Router,
    ) {
      if (isFunction(mwOrPathOrRouter)) {
        const mw = mwOrPathOrRouter;
        if (isFunction(mw[MetaKeys.metaCallback])) {
          mw[MetaKeys.metaCallback](this);
        }
        if (!mw[MetaKeys.ignoreMiddleware] && isFunction(mw)) {
          this.koaRouter.use(toKoaMiddleware(mw));
        }
      } else if (isString(mwOrPathOrRouter)) {
        this.koaRouter.use(mwOrPathOrRouter, router?.routes());
        this.routers.push([mwOrPathOrRouter, router]);
      } else {
        this.koaRouter.use(mwOrPathOrRouter.routes());
        this.routers.push([null, mwOrPathOrRouter]);
      }

      return this;
    },
  };

  router.use(() => ({
    router,
  }));

  return router;
}
