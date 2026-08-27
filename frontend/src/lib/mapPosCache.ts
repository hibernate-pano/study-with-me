/**
 * 节点位置持久化：把用户拖动 / 布局收敛后的 x,y 存到 localStorage，
 * 下次刷新地图时复用，让用户的"知识宇宙"位置稳定，不会每次重排跳来跳去。
 *
 * 数据结构：扁平 { [nodeId]: { x: number, y: number } }
 * 节点被拖动（松手）→ 更新；
 * 删除节点 → 保留旧数据以备回归（不主动清理，避免版本升级时的抖动）。
 */

const STORAGE_KEY = "concept-digger:map-pos:v1";

export type PosMap = Record<string, { x: number; y: number }>;

export function loadPosCache(): PosMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    // 防御性：每个 entry 必须有 number x/y
    const out: PosMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (
        typeof v === "object" &&
        v !== null &&
        typeof (v as PosMap[string]).x === "number" &&
        typeof (v as PosMap[string]).y === "number"
      ) {
        out[k] = v as PosMap[string];
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function savePosCache(map: PosMap): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* 隐私模式 / 容量满：静默 */
  }
}