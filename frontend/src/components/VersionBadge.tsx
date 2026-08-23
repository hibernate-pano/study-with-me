/** 右下角版本号：显示 package.json version + 构建时注入的 git commit。
 * 部署后即使页面没变化，也能靠它确认新版本是否已上线。 */
export default function VersionBadge() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  const commit = process.env.NEXT_PUBLIC_COMMIT_SHA;
  if (!version && !commit) return null;

  return (
    <div
      className="fixed bottom-2 right-3 z-10 select-none"
      title={`当前版本 v${version ?? "?"} · git commit ${commit ?? "?"}`}
    >
      <span className="font-mono text-[10px] text-slate-300 opacity-70 transition-opacity hover:opacity-100">
        v{version}
        {commit ? ` · ${commit}` : ""}
      </span>
    </div>
  );
}