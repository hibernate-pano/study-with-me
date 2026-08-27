/**
 * 与 Topic Talkshow（演讲训练）的互通入口：
 * 深挖报告 → 「开讲挑战」→ 带 ?topic= 跳到演讲工具直接开一场限时讲解。
 * ponytail: 线上域名硬编码；换部署地址时改这里即可（无配置面，闭环验证后再说）。
 */
const TALKSHOW_BASE = "https://topic-talkshow.vercel.app";

export function talkshowChallengeUrl(term: string): string {
  return `${TALKSHOW_BASE}/?topic=${encodeURIComponent(term)}`;
}
