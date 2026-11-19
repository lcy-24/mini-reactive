# mini-reactive

手写 Vue3 响应式系统核心：**reactive / ref / computed / effect / watch**，基于 `Proxy` + 依赖收集，零依赖、全 TypeScript。

既是「Vue3 响应式原理」面试手写题的**标准答案**，也是一份**可直接运行、带类型提示**的精简实现，帮你真正理解 Vue 的响应式是怎么跑起来的。

## 特性

- 🎯 **Proxy 代理**：`reactive` / `shallowReactive` / `readonly` / `shallowReadonly`
- 🔗 **依赖收集**：`effect` / `track` / `trigger`，`WeakMap` 存储依赖关系，自动清理防泄漏
- 📦 **引用包装**：`ref` / `shallowRef` / `isRef` / `unref`
- 🧮 **惰性求值**：`computed` 带缓存，依赖不变不重算，支持 getter/setter
- 👀 **侦听**：`watch`（getter / ref / 对象深度遍历）+ `watchEffect`
- ✅ 零依赖、全 TS，Node 和浏览器通用

## 安装

```bash
npm install mini-reactive
```

## 快速开始

```ts
import { reactive, effect, ref, computed, watch } from 'mini-reactive'

// 1. reactive + effect：状态变化自动执行副作用
const state = reactive({ count: 0, user: { name: '小龙' } })
effect(() => {
  console.log('count =', state.count) // 依赖收集
})
state.count++ // 自动触发，打印 "count = 1"

// 2. ref：包装原始值
const num = ref(0)
effect(() => console.log('num =', num.value))
num.value = 10

// 3. computed：惰性求值 + 缓存
const double = computed(() => state.count * 2)
console.log(double.value) // 只在首次读取时计算，之后缓存

// 4. watch：监听变化，拿到新旧值
watch(() => state.count, (nv, ov) => {
  console.log(`count: ${ov} -> ${nv}`)
})
```

## API

### reactive

| 函数 | 说明 |
| --- | --- |
| `reactive(target)` | 深度响应式代理 |
| `shallowReactive(target)` | 只代理第一层 |
| `readonly(target)` | 深度只读，修改告警 |
| `shallowReadonly(target)` | 浅层只读 |
| `isReactive(v)` | 是否响应式对象 |
| `isReadonly(v)` | 是否只读对象 |
| `toRaw(v)` | 取响应式的原始对象 |

### ref

| 函数 | 说明 |
| --- | --- |
| `ref(value)` | 包装原始值，对象转 reactive |
| `shallowRef(value)` | 对象不转 reactive |
| `isRef(v)` | 是否 ref |
| `unref(v)` | ref 取 `.value`，否则原样 |
| `triggerRef(ref)` | 手动触发 ref 更新 |

### effect

| 函数 | 说明 |
| --- | --- |
| `effect(fn, options?)` | 注册副作用，自动依赖收集，返回 runner |
| `track(target, key)` | 收集依赖（内部） |
| `trigger(target, key)` | 触发依赖（内部） |

`options.scheduler`：自定义调度（computed/watch 的惰性、去重都靠它）；`options.lazy`：创建时不立即执行。

### computed

```ts
const c = computed(() => a.value + b.value)         // 只读
const w = computed({ get: () => a.value, set: v => a.value = v }) // 可写
```

### watch

```ts
watch(source, (nv, ov) => {}, { immediate?, deep? }) // 返回停止函数
watchEffect(fn)                                      // 立即执行 + 自动追踪
```

## 原理速览

依赖收集三要素：

1. **`activeEffect`**：全局记录「当前正在执行的 effect」。
2. **`track`**：读属性时，把 `activeEffect` 存进 `targetMap[target][key]` 的 Set 里。
3. **`trigger`**：写属性时，取出该 key 的所有 effect 重新执行。

```ts
const targetMap = new WeakMap<object, Map<key, Set<effect>>>()
//   target        ->  key          -> 依赖它的 effects
```

`reactive` 就是 `Proxy` 的 `get`/`set` 里分别调用 `track`/`trigger`；`ref` 是 `value` 的 getter/setter 里调用；`computed` 是带缓存的惰性 effect。`WeakMap` 用弱引用，对象被回收后依赖表自动释放，不会泄漏。

## 与 Vue3 的差异（刻意简化）

- 不处理 `Map`/`Set` 的响应式、数组方法重写、`proxyRefs` 自动解包等边界，聚焦「依赖收集 + 触发」这条主线。
- 没有调度队列（`queueJob`）、`flush: 'post'` 等渲染相关机制，因为这些服务于组件渲染，纯逻辑场景用不到。

## License

MIT
