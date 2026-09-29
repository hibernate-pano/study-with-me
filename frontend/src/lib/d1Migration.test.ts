/**
 * db/migrate-2026-09-users-login.sql 的可执行回归测试。
 *
 * ## 为什么不是「断言 SQL 文本长这样」
 *
 * 这个迁移脚本里最贵的两行是 `PRAGMA foreign_keys = OFF` 和 `DROP TABLE users`：
 * 前者失效（被包进事务）或后者顺序提前，三张子表上的 `ON DELETE CASCADE`
 * 会在一条语句里把全站数据删光，而且脚本**不含事务、无法 ROLLBACK**。
 * 纯文本断言只能证明「字符串出现过」，证明不了「跑起来不会删库」——
 * 所以这里用 Node 内置的 `node:sqlite` 起一个内存库，把线上旧库的样子（51221c5 版
 * schema：login 还是 `TEXT UNIQUE NOT NULL`）连同真实形态的数据灌进去，
 * **把迁移脚本逐条跑一遍**，再校验行数、约束、索引、逐行数据。
 *
 * 逐条执行而不是整份 exec，还顺带把「这份脚本由哪几条语句、按什么顺序组成」
 * 变成了可断言的契约：语句条数固定、顺序固定，多一条少一条都会红。
 *
 * 顺带用两条「反例」把脚本注释里最大的两条警告变成可执行断言：
 *   - 去掉 `PRAGMA foreign_keys = OFF` → 子表被级联删空
 *   - 给整份脚本包一层 BEGIN/COMMIT   → PRAGMA 变 no-op，子表同样被级联删空
 * 这两条正是文档里「❌ 不要用 wrangler d1 migrations apply」的真实原因。
 *
 * ## 安全性
 *
 * 本文件没有任何外部输入：所有写库的值都走 prepared statement 的 `?n` 占位符绑定，
 * 被执行的 SQL 只有两份——本文件的建表常量，与仓库内固定的迁移脚本文件内容。
 * 测试里的中文术语、报告正文、复习卡问答都是贴近真实用法的静态数据。
 *
 * ## 环境
 *
 * 依赖 `node:sqlite`（Node 22.5+ 内置；CI 钉 node-version: 22）。
 * 本仓库的 @types/node 是 20.x，还没有 node:sqlite 的类型，故下面那行 @ts-expect-error。
 */
// @ts-expect-error node:sqlite 的类型要到 @types/node@22.5 才有；运行时是 Node 内置（CI 钉 node 22）
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const DB_DIR = path.resolve(import.meta.dirname, "..", "..", "db"); // frontend/db
const MIGRATION_PATH = path.join(DB_DIR, "migrate-2026-09-users-login.sql");
const SCHEMA_PATH = path.join(DB_DIR, "schema.sql");

const MIGRATION_SQL = fs.readFileSync(MIGRATION_PATH, "utf8");

/**
 * 线上 D1 的旧结构：git show 51221c5:frontend/db/schema.sql（建库那一版）。
 * 与现在的 schema.sql 只有一处不同 —— users.login 还带着 UNIQUE，
 * 那正是这次迁移要拆掉的东西。
 */
const LEGACY_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER UNIQUE NOT NULL,
  login TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  email TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE TABLE reports (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  term TEXT NOT NULL,
  parent_term TEXT,
  relation_type TEXT,
  full_text TEXT NOT NULL,
  related TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);
CREATE TABLE cards (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  term TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  due_at INTEGER NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);
`;

type Row = Record<string, unknown>;

/** 去掉 `--` 行注释，按 `;` 切成单条语句（迁移脚本里没有含 `;` 的字符串字面量） */
function statementsOf(sql: string): string[] {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 逐条执行一份 SQL 脚本。语句来自仓库内固定内容，无外部输入、无拼接。 */
function runScript(db: DatabaseSync, sql: string): string[] {
  const stmts = statementsOf(sql);
  for (const stmt of stmts) db.prepare(stmt).run();
  return stmts;
}

/** 起一个「线上旧库」：旧 schema + 外键强制（D1 默认开）+ 一名真实用户的数据 */
function productionDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  // D1 默认开着外键强制。不照实模拟，下面的反例就测不出来——关外键这条命门会被掩盖。
  runScript(db, "PRAGMA foreign_keys = ON;");
  runScript(db, LEGACY_SCHEMA);

  // 数据一律走参数绑定，没有一条拼接 SQL
  const insertUser = db.prepare(
    "INSERT INTO users (id, github_id, login, avatar_url, email, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)"
  );
  insertUser.run(1, 9527, "panbo", "https://avatars.githubusercontent.com/u/9527", "jasper@example.com", 1727000000000);
  // 第二个账号：换了 GitHub 号，登录名还没被回收（迁移后这两行必须能共存）
  insertUser.run(2, 778899, "jasper-new", null, null, 1727600000000);

  db.prepare("INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)").run(
    "a3f1c9e2b7d84a06f1c2e3d4b5a69780c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
    1,
    1790000000000,
    1727000000000
  );

  const insertReport = db.prepare(
    "INSERT INTO reports (user_id, key, term, parent_term, relation_type, full_text, related, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)"
  );
  insertReport.run(1, "1727000000000-惰性求值", "惰性求值", "函数式编程", "属于", "# 惰性求值\n\n把计算推迟到真正需要的那一刻。", "[]", 1727000000000);
  insertReport.run(1, "1727000000001-索引失效", "索引失效", "数据库索引", "前置知识", "# 索引失效\n\n最左前缀、隐式类型转换、函数包裹列。", "[]", 1727000001000);
  insertReport.run(2, "1727600000000-写放大", "写放大", "LSM 树", "属于", "# 写放大\n\n读放大了写。", "[]", 1727600000000);

  const insertCard = db.prepare(
    "INSERT INTO cards (user_id, key, term, question, answer, due_at, interval_days, reps, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)"
  );
  insertCard.run(1, "1727000000000-惰性求值#c1", "惰性求值", "惰性求值把计算的时机推迟到哪里？", "推迟到结果第一次被真正需要的那一刻。", 1727086400000, 1, 0, "new", 1727000000000);
  insertCard.run(1, "1727000000001-索引失效#c1", "索引失效", "什么会导致联合索引失效？", "违反最左前缀、对索引列做函数或隐式类型转换。", 1727086400000, 1, 0, "new", 1727000001000);

  return db;
}

const TABLES = ["users", "sessions", "reports", "cards"] as const;

function counts(db: DatabaseSync): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of TABLES) {
    out[t] = (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as Row).n as number;
  }
  return out;
}

function tableSql(db: DatabaseSync, name = "users"): string {
  return (db.prepare("SELECT sql FROM sqlite_schema WHERE tbl_name = ?1 AND sql IS NOT NULL").all(name) as Row[])
    .map((r) => r.sql as string)
    .join("\n");
}

function indexesOf(db: DatabaseSync, table = "users"): Array<{ name: string; unique: number }> {
  return db.prepare(`PRAGMA index_list(${table})`).all() as unknown as Array<{ name: string; unique: number }>;
}

let db: DatabaseSync;
beforeEach(() => {
  db = productionDb();
});

describe("登录名降级迁移：唯一约束真的拆掉了，数据一条没丢", () => {
  it("迁移前 login 确实是唯一键（否则下面几条断言没有意义）", () => {
    expect(() =>
      db.prepare("INSERT INTO users (github_id, login, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)").run(
        556677,
        "panbo", // 与库里已有的 panbo 同名
        1727700000000
      )
    ).toThrow(/UNIQUE/i);
  });

  it("迁移后同名用户能落行（auth.ts 的 ON CONFLICT (github_id) 不再被 login 约束打断）", () => {
    runScript(db, MIGRATION_SQL);
    expect(() =>
      db.prepare("INSERT INTO users (github_id, login, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)").run(
        556677,
        "panbo",
        1727700000000
      )
    ).not.toThrow();
  });

  it("github_id 的唯一性必须保留（它才是身份依据，去掉会产生重复用户行）", () => {
    runScript(db, MIGRATION_SQL);
    expect(() =>
      db.prepare("INSERT INTO users (github_id, login, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)").run(
        9527, // 已有账号的 github_id
        "另一个名字",
        1727700000000
      )
    ).toThrow(/UNIQUE/i);
    expect(tableSql(db)).toContain("github_id INTEGER UNIQUE NOT NULL");
  });

  it("四张表行数与执行前逐一相等（迁移文件要求的执行后校验，第 1 条）", () => {
    const before = counts(db);
    expect(before).toEqual({ users: 2, sessions: 1, reports: 3, cards: 2 });

    runScript(db, MIGRATION_SQL);

    expect(counts(db), "任何一张表对不上，立刻从导出备份恢复").toEqual(before);
  });

  it("子表数据逐行还在：只有 COUNT 对得上不够，内容也得原样", () => {
    runScript(db, MIGRATION_SQL);

    const report = db.prepare("SELECT * FROM reports WHERE key = ?1 AND user_id = ?2").get(
      "1727000000001-索引失效",
      1
    ) as Row;
    expect(report.term).toBe("索引失效");
    expect(report.parent_term).toBe("数据库索引");
    expect(report.full_text).toContain("最左前缀");

    const card = db.prepare("SELECT * FROM cards WHERE key = ?1").get("1727000000000-惰性求值#c1") as Row;
    expect(card.answer).toBe("推迟到结果第一次被真正需要的那一刻。");

    // user_id 原样搬过去，所以子表不用改；这里钉住「A 的数据没串到 B 名下」
    const owners = db.prepare("SELECT DISTINCT user_id FROM reports ORDER BY user_id").all() as Row[];
    expect(owners.map((o) => o.user_id)).toEqual([1, 2]);
  });

  it("旧表上 login 的隐式唯一索引消失，只剩 github_id 那一个（login 改挂普通索引）", () => {
    const autoIndexes = () => indexesOf(db).filter((i) => i.name.startsWith("sqlite_autoindex_users_"));
    // 旧表：github_id UNIQUE + login UNIQUE → 两个隐式自动索引
    expect(autoIndexes()).toHaveLength(2);

    runScript(db, MIGRATION_SQL);

    // 迁移后：login 的 UNIQUE 没了，但 github_id 的 UNIQUE 必须还在（auth.ts 依赖它），
    // 所以隐式索引从 2 个降到 1 个，而不是「一个都不剩」
    expect(autoIndexes(), "login 的 UNIQUE 隐式索引应随旧表消失，github_id 的那个必须保留").toHaveLength(1);
    const idx = indexesOf(db);
    expect(idx.map((i) => i.name)).toContain("idx_users_login");
    // login 上的索引必须是普通索引（非唯一），否则迁移等于没做
    expect(idx.find((i) => i.name === "idx_users_login")?.unique, "idx_users_login 不能是唯一索引").toBe(0);
    expect(tableSql(db)).toContain("CREATE INDEX idx_users_login ON users(login)");
  });

  it("执行完外键强制要开回去（脚本最后一步）", () => {
    runScript(db, MIGRATION_SQL);
    expect((db.prepare("PRAGMA foreign_keys").get() as Row).foreign_keys).toBe(1);
  });

  it("可重复执行：成功跑完再跑一遍是安全的 no-op", () => {
    runScript(db, MIGRATION_SQL);
    const after1 = counts(db);

    runScript(db, MIGRATION_SQL);

    expect(counts(db)).toEqual(after1);
    expect((db.prepare("SELECT COUNT(*) AS n FROM users WHERE login = ?1").get("panbo") as Row).n).toBe(1);
  });

  it("脚本由固定这 8 条语句组成（少一条、多一条、或换顺序都会红）", () => {
    const stmts = statementsOf(MIGRATION_SQL);
    expect(stmts, "迁移脚本的语句条数变了，请同步更新本用例").toHaveLength(8);
    expect(stmts.map((s) => s.split(/\s+/)[0].toUpperCase())).toEqual([
      "PRAGMA", // 关外键
      "CREATE", // 建 users_new
      "INSERT", // 搬数据
      "DROP", // 删旧表
      "ALTER", // 改名
      "CREATE", // 重建 login 索引
      "PRAGMA", // foreign_key_check 自检
      "PRAGMA", // 外键开回去
    ]);
  });
});

/**
 * 反例：把脚本注释里那两条警告跑成真的。
 * 它们不是「假装失败」，而是在证明**这份脚本的危险点是真的、也是被真正防住的**——
 * 哪天有人图省事给脚本包一层事务，或者在 D1 Console 里先手工 DROP 一下，
 * 这两条就是那份改动该被拦下的证据。
 */
describe("迁移的危险点：脚本注释里的两条警告是真的", () => {
  /** 去掉可执行的那句 PRAGMA（只认整行独立语句，不会误伤注释里提到它的地方） */
  const withoutForeignKeysOff = () =>
    MIGRATION_SQL.replace(/^\s*PRAGMA\s+foreign_keys\s*=\s*OFF\s*;\s*$/gim, "");

  it("不开外键就执行 → DROP TABLE users 把三张子表级联删空（这就是必须先导备份的原因）", () => {
    expect(counts(db)).toEqual({ users: 2, sessions: 1, reports: 3, cards: 2 });
    const stripped = withoutForeignKeysOff();
    expect(stripped, "没匹配到 PRAGMA foreign_keys = OFF 语句，脚本形状变了，请同步更新本用例").not.toBe(MIGRATION_SQL);

    runScript(db, stripped);

    expect(counts(db).users).toBe(2); // users 自己搬过去了
    expect(counts(db), "外键强制还开着，sessions/reports/cards 全被 ON DELETE CASCADE 清空").toEqual({
      users: 2,
      sessions: 0,
      reports: 0,
      cards: 0,
    });
  });

  it("把整份脚本包进 BEGIN/COMMIT → PRAGMA 变 no-op，同样级联删空（所以禁用 migrations apply）", () => {
    expect(counts(db)).toEqual({ users: 2, sessions: 1, reports: 3, cards: 2 });

    db.prepare("BEGIN").run();
    try {
      runScript(db, MIGRATION_SQL);
      db.prepare("COMMIT").run();
    } catch (e) {
      db.prepare("ROLLBACK").run();
      throw e;
    }

    expect(
      counts(db),
      "SQLite 规定 PRAGMA foreign_keys 在事务内设置是 no-op，包了事务等于没关外键"
    ).toEqual({ users: 2, sessions: 0, reports: 0, cards: 0 });
  });

  it("迁移本体自带一行 BEGIN/COMMIT 就是错的（它必须整体留在事务外）", () => {
    // 与上一条互为对照：脚本里一旦出现 BEGIN;/COMMIT;，上一条的反例就成了「正确用法」
    expect(MIGRATION_SQL).not.toMatch(/^\s*BEGIN\s*(TRANSACTION)?\s*;/im);
    expect(MIGRATION_SQL).not.toMatch(/^\s*COMMIT\s*;/im);
  });
});

/**
 * 结构契约：把「顺序」钉死。
 * 上面的执行测试已经证明了危险，下面这组能在文件被重排时给出更直白的失败信息，
 * 而且不依赖 node:sqlite（万一将来 Node 换版本，这里仍然有效）。
 */
describe("迁移脚本的结构：顺序就是安全性", () => {
  const at = (needle: RegExp) => {
    // 用 exec 而不是 match：带 /g 的 String.match 返回的数组上没有 index
    const m = needle.exec(MIGRATION_SQL);
    expect(m, `迁移脚本里找不到 ${needle}`).not.toBeNull();
    return m!.index;
  };

  it("关外键必须在删表之前", () => {
    expect(at(/^\s*PRAGMA\s+foreign_keys\s*=\s*OFF\s*;/im)).toBeLessThan(at(/^\s*DROP\s+TABLE\s+users\s*;/im));
  });

  it("建新表必须在搬数据之前，搬数据必须在删表之前（顺序反了就是空表搬家）", () => {
    expect(at(/CREATE\s+TABLE\s+users_new/i)).toBeLessThan(at(/INSERT\s+INTO\s+users_new\s+SELECT\s+\*\s+FROM\s+users\s*;/i));
    expect(at(/INSERT\s+INTO\s+users_new\s+SELECT\s+\*\s+FROM\s+users\s*;/i)).toBeLessThan(
      at(/^\s*DROP\s+TABLE\s+users\s*;/im)
    );
  });

  it("改名必须在删表之后，索引必须在改名之后", () => {
    const drop = at(/^\s*DROP\s+TABLE\s+users\s*;/im);
    const rename = at(/ALTER\s+TABLE\s+users_new\s+RENAME\s+TO\s+users\s*;/i);
    const index = at(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_users_login/i);
    expect(drop).toBeLessThan(rename);
    expect(rename).toBeLessThan(index);
  });

  it("不得自动 DROP 掉 users_new（它可能是上一次中断时全量数据的唯一副本）", () => {
    // 只看可执行语句：脚本注释里正写着「刻意不写 DROP TABLE IF EXISTS users_new」，
    // 直接对原文做匹配会被这句注释自己判红。
    for (const stmt of statementsOf(MIGRATION_SQL)) {
      expect(stmt, "不得自动 DROP 掉 users_new").not.toMatch(/^DROP\s+TABLE\s+(IF\s+EXISTS\s+)?users_new/i);
    }
  });

  it("新表必须保留 github_id 的 UNIQUE，且 login 不再带 UNIQUE", () => {
    const ddl = MIGRATION_SQL.match(/CREATE\s+TABLE\s+users_new\s*\(([\s\S]*?)\n\)\s*;/i);
    expect(ddl, "没找到 CREATE TABLE users_new").not.toBeNull();
    expect(ddl![1]).toMatch(/github_id\s+INTEGER\s+UNIQUE\s+NOT\s+NULL/i);
    expect(ddl![1]).toMatch(/login\s+TEXT\s+NOT\s+NULL/i);
    expect(ddl![1], "login 不能带 UNIQUE，否则这脚本等于什么都没做").not.toMatch(/login[^,\n]*UNIQUE/i);
  });

  it("schema.sql 与迁移脚本的最终状态一致：存档里的 users 表也不能再写 login UNIQUE", () => {
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    const ddl = schema.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+users\s*\(([\s\S]*?)\n\)\s*;/i);
    expect(ddl, "没找到 schema.sql 里的 users 建表语句").not.toBeNull();
    expect(ddl![1], "schema.sql 的 users.login 还带 UNIQUE，存档与迁移结果对不上").not.toMatch(/login[^,\n]*UNIQUE/i);
    expect(schema).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_users_login\s+ON\s+users\(login\)/i);
  });
});
