/**
 * 状态变更端点的 Origin 白名单 —— 整个服务端只有这一处判定，所有写路由共用。
 *
 * 存在的原因（别删，也别只在一个路由里「记得」加）：
 *   会话 cookie 是 SameSite=Lax，跨站 POST 本来就带不上 cookie；
 *   但**同站**（schemeful site = panbo.space，共享 cookie 的 Domain 就在这里）
 *   的任意 JS —— 例如 topic-talkshow 出了 XSS —— 可以带着 cookie 跨源发 fetch，
 *   而 text/plain 属 CORS-safelisted、跨站不发预检，服务端若不看 Origin 就是一次盲写。
 *   读方向浏览器已经挡住（全站无任何 Access-Control 头），所以这里防的是盲写/盲删，
 *   不是信息泄漏。
 *
 * 信任域 = 本请求的 host + panbo.space 家族（后者正是共享 cookie 的域，见 session.ts
 * 的 DOMAIN_ATTR）。**不要靠收窄 cookie 域来加固**：tts_session 是这套 SSO 的身份载体，
 * 收窄会让兄弟应用永久收不到凭证、免登直接坏掉；CSRF 该在这里兜。
 *
 * 代价必须说清：panbo.space 家族里的兄弟源同样能过这关，所以「兄弟子域 XSS → 盲写」
 * 这条路本守卫**没有**闭合，要闭合得靠 CSRF token 或收窄 cookie 域，两者都要动
 * session.ts / 客户端，不在本守卫职责内。
 *
 * 只依赖 req.nextUrl.host，不 import session.ts —— 别把服务端逻辑拖进客户端包。
 * `import type` 编译期即擦除，不会产生任何运行时依赖。
 */
import type { NextRequest } from "next/server";

export function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false; // 浏览器对 POST 必带 Origin；缺 Origin 一律拒（curl 请自备）
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  if (host === req.nextUrl.host) return true; // 同源（含 localhost 各种端口）
  return host.endsWith(".panbo.space");
}
