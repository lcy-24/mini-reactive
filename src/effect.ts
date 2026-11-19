/**
 * 依赖收集与触发（响应式系统核心）
 *
 * 原理：用 WeakMap<target, Map<key, Set<effect>>> 记录「对象 → 属性 → 依赖它的 effect」。
 * 读取属性时 track 收集依赖，写入属性时 trigger 触发依赖。
 */

export type Cleanup = () => void

export interface ReactiveEffectOptions {
  /** 自定义调度器：不立即执行，而是交给调度器（computed、watch 依赖它） */
  scheduler?: (fn: () => void) => void
  /** 惰性：创建时不立即执行，由调用方手动 run */
  lazy?: boolean
}

/** 当前正在执行的 effect（全局栈顶） */
let activeEffect: ReactiveEffect | undefined = undefined

/** 全局依赖表：target -> key -> effects */
const targetMap = new WeakMap<object, Map<PropertyKey, Set<ReactiveEffect>>>()

export class ReactiveEffect {
  fn: () => any
  scheduler?: (fn: () => void) => void
  /** 记录自己出现在哪些 dep 里，用于 stop 时清理 */
  deps: Set<ReactiveEffect>[] = []
  active = true

  constructor(fn: () => any, scheduler?: (fn: () => void) => void) {
    this.fn = fn
    this.scheduler = scheduler
  }

  /** 执行 effect，执行前把自己设为 activeEffect，让 track 能找到 */
  run(): any {
    if (!this.active) return this.fn()
    activeEffect = this
    const result = this.fn()
    activeEffect = undefined
    return result
  }

  /** 停止：从所有 dep 中移除自己，避免内存泄漏 */
  stop(): void {
    if (!this.active) return
    this.cleanup()
    this.active = false
  }

  cleanup(): void {
    for (const dep of this.deps) dep.delete(this)
    this.deps.length = 0
  }
}

/** 收集依赖：把当前 activeEffect 挂到 target[key] 的 dep 上 */
export function track(target: object, key: PropertyKey): void {
  if (!activeEffect) return
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }
  let dep = depsMap.get(key)
  if (!dep) {
    dep = new Set()
    depsMap.set(key, dep)
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

/** 触发依赖：执行 target[key] 关联的所有 effect（有 scheduler 走 scheduler） */
export function trigger(target: object, key: PropertyKey): void {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  const dep = depsMap.get(key)
  if (!dep) return
  // 拷贝一份，防止执行过程中 dep 被修改（比如 effect 里又删了依赖）
  const effects = new Set(dep)
  for (const e of effects) {
    if (e.scheduler) e.scheduler(() => e.run())
    else e.run()
  }
}

/** 注册副作用函数，返回可手动执行/停止的 runner */
export function effect(fn: () => any, options?: ReactiveEffectOptions): () => any {
  const _effect = new ReactiveEffect(fn, options?.scheduler)
  if (!options?.lazy) _effect.run()
  const runner = _effect.run.bind(_effect) as (() => any) & { effect: ReactiveEffect }
  runner.effect = _effect
  return runner
}

/** 判断是否为对象（响应式只对对象生效，原始值用 ref 包） */
export function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object'
}
