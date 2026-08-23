// 让 Node 环境拥有浏览器 IndexedDB 实现（storage.ts 依赖）
import "fake-indexeddb/auto";

// Node 无 localStorage（Node 22 默认不启用）——用内存 stub 支撑 sync.ts 的待推队列持久化
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  },
  configurable: true,
});