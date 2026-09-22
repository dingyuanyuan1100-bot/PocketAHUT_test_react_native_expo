/**
 * 令牌持久化层。
 *
 * 优先使用 expo-secure-store（iOS Keychain / Android Keystore 加密存储），
 * 原生模块不可用时（例如依赖刚装上、还没重新构建原生包）自动降级为
 * 「本次进程内内存」，保证 App 不会因为存储层而启动崩溃。
 *
 * 注意：这里刻意用**动态 import** 而不是顶层静态 import ——
 * expo-secure-store 在模块求值阶段就会调用 requireNativeModule，
 * 原生侧缺失时静态 import 会直接抛错并中断整个 bundle 的加载。
 */

type SecureStoreModule = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

/** undefined = 还没探测过；null = 探测过且不可用 */
let nativeStore: SecureStoreModule | null | undefined;

async function loadNativeStore(): Promise<SecureStoreModule | null> {
  if (nativeStore !== undefined) return nativeStore;
  try {
    const mod = (await import('expo-secure-store')) as unknown as SecureStoreModule;
    // 探测一次真实调用，避免「模块能加载但原生未链接」的假阳性
    await mod.getItemAsync('__probe__');
    nativeStore = mod;
  } catch {
    nativeStore = null;
  }
  return nativeStore;
}

/** 内存兜底（与 nativeStore 并存，保证降级时行为一致） */
const memory = new Map<string, string>();

export const tokenStorage = {
  async get(key: string): Promise<string | null> {
    const store = await loadNativeStore();
    if (!store) return memory.get(key) ?? null;
    try {
      return await store.getItemAsync(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    memory.set(key, value);
    const store = await loadNativeStore();
    if (!store) return;
    try {
      await store.setItemAsync(key, value);
    } catch {
      // 写入失败不影响内存副本，本次会话仍可用
    }
  },

  async remove(key: string): Promise<void> {
    memory.delete(key);
    const store = await loadNativeStore();
    if (!store) return;
    try {
      await store.deleteItemAsync(key);
    } catch {
      // 忽略
    }
  },

  /** 当前是否在用原生加密存储（用于启动日志 / 调试面板展示） */
  async isPersistent(): Promise<boolean> {
    return (await loadNativeStore()) !== null;
  },
};
