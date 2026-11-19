import { ReactiveEffect, isObject } from './effect'
import { isRef } from './ref'

export type WatchSource<T = any> = (() => T) | { value: T } | object

export interface WatchOptions {
  /** 立即执行一次回调 */
  immediate?: boolean
  /** 深度监听（递归遍历对象所有属性） */
  deep?: boolean
}

/** 深度遍历对象所有属性，触发依赖收集（deep watch 用） */
function traverse(value: unknown, seen = new Set<unknown>()): unknown {
  if (!isObject(value) || seen.has(value)) return value
  seen.add(value)
  for (const key in value as object) {
    traverse((value as any)[key], seen)
  }
  return value
}

/**
 * 监听响应式数据变化。
 * source 支持：getter 函数 / ref / reactive 对象（自动深度遍历）。
 * 返回停止函数。
 */
export function watch<T>(
  source: WatchSource<T>,
  cb: (newValue: T, oldValue: T | undefined) => void,
  options: WatchOptions = {}
): () => void {
  let getter: () => T
  if (typeof source === 'function') {
    getter = source as () => T
  } else if (isRef(source)) {
    getter = () => source.value as T
  } else {
    // 对象默认深度监听
    getter = () => traverse(source) as T
  }

  if (options.deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter()) as T
  }

  let oldValue: T | undefined

  const job = () => {
    const newValue = effect.run()
    cb(newValue, oldValue)
    oldValue = newValue
  }

  const effect = new ReactiveEffect(getter, job)

  if (options.immediate) {
    job()
  } else {
    oldValue = effect.run()
  }

  return () => effect.stop()
}

/** 立即执行的副作用，自动追踪依赖，返回停止函数 */
export function watchEffect(fn: () => void): () => void {
  const effect = new ReactiveEffect(fn)
  effect.run()
  return () => effect.stop()
}
