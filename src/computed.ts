import { track, trigger, ReactiveEffect } from './effect'

class ComputedRefImpl<T> {
  private _value: T | undefined
  private _dirty = true
  private _effect: ReactiveEffect
  public readonly __v_isRef = true

  constructor(getter: () => T) {
    // 依赖变化时只标脏 + 触发 computed 的订阅者，不立即重算（惰性求值）
    this._effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true
        trigger(this, 'value')
      }
    })
  }

  get value(): T {
    // 惰性求值：脏了才重算，多次读取只算一次（缓存）
    if (this._dirty) {
      this._value = this._effect.run()
      this._dirty = false
    }
    track(this, 'value')
    return this._value as T
  }
}

/**
 * 计算属性：惰性求值 + 缓存，依赖变化才重算。
 * 传入 getter 返回只读 computed；传入 { get, set } 返回可写 computed。
 */
export function computed<T>(getter: () => T): { readonly value: T }
export function computed<T>(options: { get: () => T; set: (v: T) => void }): { value: T }
export function computed<T>(getterOrOptions: (() => T) | { get: () => T; set: (v: T) => void }) {
  let getter: () => T
  let setter: ((v: T) => void) | undefined

  if (typeof getterOrOptions === 'function') {
    getter = getterOrOptions
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  const ref = new ComputedRefImpl(getter)

  if (setter) {
    return {
      get value() { return ref.value },
      set value(v: T) { setter!(v) },
      __v_isRef: true,
    }
  }
  return ref
}
