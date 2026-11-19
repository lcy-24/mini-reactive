import { track, trigger, isObject } from './effect'

/** 内部标志 key，用于判断对象是否已代理、取原始对象 */
export enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
  RAW = '__v_raw',
}

/** 避免同一对象被重复代理，缓存代理结果 */
const reactiveMap = new WeakMap<object, any>()

function hasOwn(target: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(target, key)
}

function createReactive<T extends object>(
  target: T,
  isShallow = false,
  isReadonly = false
): T {
  if (!isObject(target)) return target

  // 已代理过（响应式/只读）直接返回，避免重复包装
  if ((target as any)[ReactiveFlags.RAW]) return target

  // 命中缓存
  const cached = reactiveMap.get(target)
  if (cached) return cached

  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      // 内部标志直接返回，不参与依赖收集
      if (key === ReactiveFlags.IS_REACTIVE) return !isReadonly
      if (key === ReactiveFlags.IS_READONLY) return isReadonly
      if (key === ReactiveFlags.RAW) return target

      if (!isReadonly) track(target, key)

      const res = Reflect.get(target, key, receiver)
      // 浅层响应式：嵌套对象不再代理
      if (isShallow) return res
      // 深度响应式：嵌套对象惰性代理（读到才包，性能好）
      if (isObject(res)) return isReadonly ? readonly(res) : reactive(res)
      return res
    },
    set(target, key, value, receiver) {
      if (isReadonly) {
        console.warn(`[mini-reactive] 只读对象不可修改：${String(key)}`)
        return true
      }
      const oldValue = (target as any)[key]
      const hadKey = hasOwn(target, key)
      const res = Reflect.set(target, key, value, receiver)
      // 新增属性 or 值变化才触发，避免无意义的重跑
      if (!hadKey) trigger(target, key)
      else if (oldValue !== value) trigger(target, key)
      return res
    },
    deleteProperty(target, key) {
      if (isReadonly) {
        console.warn(`[mini-reactive] 只读对象不可删除：${String(key)}`)
        return true
      }
      const hadKey = hasOwn(target, key)
      const res = Reflect.deleteProperty(target, key)
      if (hadKey && res) trigger(target, key)
      return res
    },
    has(target, key) {
      if (!isReadonly) track(target, key)
      return Reflect.has(target, key)
    },
    ownKeys(target) {
      // 依赖 ITERATE_KEY，让 for...in / Object.keys 也能被追踪
      if (!isReadonly) track(target, 'iterate')
      return Reflect.ownKeys(target)
    },
  })

  reactiveMap.set(target, proxy)
  return proxy
}

/** 深度响应式代理（最常用） */
export function reactive<T extends object>(target: T): T {
  return createReactive(target, false, false)
}

/** 浅层响应式：只代理第一层，嵌套对象仍是原始引用 */
export function shallowReactive<T extends object>(target: T): T {
  return createReactive(target, true, false)
}

/** 深度只读代理：禁止修改，嵌套对象也只读 */
export function readonly<T extends object>(target: T): T {
  return createReactive(target, false, true)
}

/** 浅层只读 */
export function shallowReadonly<T extends object>(target: T): T {
  return createReactive(target, true, true)
}

/** 判断是否响应式对象 */
export function isReactive(value: unknown): boolean {
  return !!(value && (value as any)[ReactiveFlags.IS_REACTIVE])
}

/** 判断是否只读对象 */
export function isReadonly(value: unknown): boolean {
  return !!(value && (value as any)[ReactiveFlags.IS_READONLY])
}

/** 取响应式对象的原始对象 */
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as any)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}
