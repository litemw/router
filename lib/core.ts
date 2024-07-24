import Koa from 'koa';
import KoaRouter from 'koa-router';
import { once } from 'lodash';

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
];

/**
 * Koats middleware with parametrized state.
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
export type Middleware<State = unknown, Return = unknown> = (
  ctx: Koa.ParameterizedContext<State, KoaRouter.IRouterParamContext>,
  next: Koa.Next,
) => PromiseOr<Return>;

/**
 * Type of Middleware or pure metadata object
 */
export type MiddlewareOrMeta<State = unknown, Return = unknown> =
  | Middleware<State, Return>
  | NonNullable<unknown>;

/**
 * Converts Koats middleware to default koa middleware
 * @param mw - koats middleware
 */
export function toKoaMiddleware(mw: Middleware): KoaRouter.IMiddleware {
  return async (ctx, next) => {
    next = once(next);
    const res = await mw(ctx, next);
    Object.assign(ctx.state, res);
    return next();
  };
}

/**
 * Middleware metadata utility keys
 */
export const MetaKeys = {
  metaOnly: 'meta-only',
  ignoreMeta: 'ignore-meta',
};

export const MetaKeyValues = Object.values(MetaKeys);
