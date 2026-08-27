/**
 * 与 Topic Talkshow（演讲训练）的互通入口：
 * 深挖报告 → 「开讲挑战」→ 带 ?topic= 跳到演讲工具直接开一场限时讲解。
 * `dd=1` 是深挖完成信号（此按钮仅在报告存在时可见/可用），演讲工具据此把词
 * 标记为「已深挖」，跨端无法共哼 localStorage，只能靠 URL 回传。
 * ponytail: 线上域名硬编码；换部署地址时改这里即可（无配置面，闭环验证后再说）。
 */
const TALKSHOW_BASE = "https://topic-talkshow.panbo.space";

export function talkshowChallengeUrl(term: string): string {
  return `${TALKSHOW_BASE}/?topic=${encodeURIComponent(term)}&dd=1`;
}
