/**
 * 流式过滤 <think>...</think> 标签内的内容（MiniMax M 系列会在
 * delta.content 里包思考过程），同时保留流式特性：
 * - 遇到 "<think>" 时进入"屏蔽模式"，不再 send；
 * - 遇到 "</think>" 时退出屏蔽模式；
 * - 跨多个 delta 的标签被拼起来再判断。
 *
 * 不是简单的正则替换（正则会丢流式粒度）：
 * 维护一个"挂起片段"，只有不属于挂起片段的内容才 send 出去。
 *
 * 如果上游在请求中传了 thinking: { type: "disabled" }，就不会有这些标签，
 * 这个过滤器就退化为零透传，代价很低。
 */
export class ThinkingFilter {
  private buf = "";
  private hiding = false;
  private done = false;

  private static readonly START = "<think>";
  private static readonly END = "</think>";
  // 这里是 < 前缀以外的 “部分开始标签”长度：1（"◀"），需保留起始 '<' 字符。
  private static readonly PREFIX_LEN = 1;

  /** 输入一段 delta 文本，返回应当发送给客户端的内容（可能为空字符串） */
  push(delta: string): string {
    if (this.done || !delta) return "";
    let work = this.buf + delta;
    let out = "";

    while (work.length > 0) {
      if (this.hiding) {
        const endIdx = work.indexOf(ThinkingFilter.END);
        if (endIdx === -1) {
          // 还没出现结束标签，继续累积到 buf 等下一帧
          this.buf = work;
          return out;
        }
        // 跳过 end 标签之前的内容 + 标签本身
        work = work.slice(endIdx + ThinkingFilter.END.length);
        this.hiding = false;
        // 继续循环，看后面是否还有可见内容
      } else {
        const startIdx = work.indexOf(ThinkingFilter.START);
        if (startIdx === -1) {
          // 没有完整的开始标签。可能是没有，也可能是还不完整（“<think>”）。
          // 从右起找最后一个 '<'，'<' 之前都可发，'<' 起的（可能是不完整标签）暂存。
          const lastLt = work.lastIndexOf("<");
          if (lastLt <= 0) {
            // lastLt === 0：work 以 '<' 开头（不完整标签），暂存等下一帧
            // lastLt === -1：没有 '<', work 全部可发
            if (lastLt === 0) {
              this.buf = work;
            } else {
              out += work;
              this.buf = "";
            }
            return out;
          }
          // '<' 之前的都可发，'<' 起（含）暂存
          out += work.slice(0, lastLt);
          this.buf = work.slice(lastLt);
          return out;
        }
        // 开始标签之前的内容是可发送的
        out += work.slice(0, startIdx);
        work = work.slice(startIdx + ThinkingFilter.START.length);
        this.hiding = true;
        // 继续循环，看后面是否有结束标签
      }
    }

    this.buf = "";
    return out;
  }

  /** 流结束时调用，把挂起的尾巴也吐出来（理论上不会有未闭合的 thinking） */
  flush(): string {
    if (this.done) return "";
    this.done = true;
    const tail = this.buf;
    this.buf = "";
    // 如果还在 hiding 状态（没遇到结束标签），丢弃
    if (this.hiding) return "";
    return tail;
  }
}