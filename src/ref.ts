import { track, trigger, isObject } from './effect'
import { reactive } from './reactive'

/** 把对象转成响应式，非对象原样返回 */
function toReactive(value: unknown): unknown {
  return isObject(value) ? reactive(value as object) : value
}

class RefImpl<T> {
  private _value: T
  private _rawValue: T
  public readonly __v_isRef = true

  constructor(value: T, private _shallow = false) {
    this._rawValue = value
    this._value = _shallow ? value : (toReactive(value) as T)
  }

  get value(): T {
    track(this, 'value')
    return this._value
  }

  set value(newVal: T) {
    // 用原始值比较，避免响应式代理对象的引用比较失效
    if (newVal !== this._rawValue) {
      this._rawValue = newVal
      this._value = this._shallow ? newVal : (toReactive(newVal) as T)
      trigger(this, 'value')
    }
  }
}

/** 包装原始值为响应式引用，对象会转成 reactive */
export function ref<T>(value: T): { value: T } {
  return new RefImpl(value, false)
}

/** 浅层 ref：对象不转 reactive */
export function shallowRef<T>(value: T): { value: T } {
  return new RefImpl(value, true)
}

/** 判断是否为 ref */
export function isRef<T>(value: unknown): value is { value: T } {
  return !!(value && (value as any).__v_isRef)
}

/** 解包：ref 取 .value，否则原样返回 */
export function unref<T>(value: T): T {
  return isRef(value) ? (value.value as T) : value
}

/** 手动触发 ref 更新（内部使用，值未变但需强制刷新时） */
export function triggerRef(ref: { value: unknown }): void {
  trigger(ref as object, 'value')
}
