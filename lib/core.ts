import Koa from 'koa';
import KoaRouter from 'koa-router';
import { RouteHandler } from './route-handler';
import { Router } from './router';
import once from 'lodash/once.js';

/**
 * Merge object types rewriting properties of first one
 * @typeParam T - source type
 * @typeParam V - overwrite type
 * @example
 * ```
 * type A = { a: number, b: string }
 * type B = { b: boolean }
 * type Result = Rewrite<A, B> // Result = { a: number, b: boolean };
 * ```
 */
export type Rewrite<T, V> = Omit<T, keyof V> & V;

/**
 * Promise or value of type V
 * @typeParam V - source type
 * @example
 * ```
 * PromiseOr<number>; // = number | Promise<number>
 * ```
 */
export type PromiseOr<T> = T | Promise<T>;

/**
 * http methods
 */
export type MethodsType =
  | 'get'
  | 'post'
  | 'put'
  | 'del'
  | 'patch'
  | 'head'
  | 'options'
  | 'link'
  | 'unlink'
  | 'all';

export const MethodsArray = [
  'get',
  'post',
  'put',
  'del',
  'patch',
  'head',
  'options',
  'link',
  'unlink',
  'all',
] as const satisfies string[];

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DefaultState {}

export type NextObject = Koa.Next & {
  cancel: () => void;
};

/**
 * Middleware function with parametrized state.
 * If you call next() manually you MUST guarantee you update ctx.state according to return type
 * @typeParam State - type of incoming ctx.state
 * @typeParam Return - return type of middleware
 * @example
 * ```
 * const mw: Middleware<{ num: number }> = (ctx, next) => {
 *   ctx.state.num; // accessible state property
 *   return { str: 'string' }; // will be placed in context.state
 * };
 * ```
 */
export type MiddlewareFunction<State = unknown, Return = unknown> = (
  ctx: Koa.ParameterizedContext<
    State & DefaultState,
    Koa.DefaultContext & KoaRouter.IRouterParamContext
  >,
  next: NextObject,
) => PromiseOr<Return>;

/**
 * Meta-callback for routers and handlers
 */
export type MetaCallback = (router: Router, handler?: RouteHandler) => void;

/**
 * Middleware metadata utility keys
 */
export enum MetaKeys {
  metaCallback = 'metaCallback',
  ignoreMiddleware = 'ignoreMiddleware',
}

export type MiddlewareMetadata = {
  [MetaKeys.metaCallback]?: MetaCallback;
  [MetaKeys.ignoreMiddleware]?: boolean;
};

/**
 * Middleware with metadata
 */
export type Middleware<State = unknown, Return = unknown> = MiddlewareFunction<
  State,
  Return
> &
  MiddlewareMetadata;

/**
 * Converts our middleware to default koa middleware
 * @param mw - middleware
 */
export function toKoaMiddleware(mw: Middleware): KoaRouter.IMiddleware {
  return async (ctx, koaNext: Koa.Next) => {
    const next = once(koaNext) as NextObject;

    let callNext = () => {
      return next();
    };

    next.cancel = () => {
      callNext = () => Promise.resolve();
    };

    const res = await mw(ctx, next);
    Object.assign(ctx.state, res);

    return callNext();
  };
}
