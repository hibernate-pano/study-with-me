/**
 * MUI v7 兼容组件：新版 Grid 移除了 item/xs/sm/md 等旧 API。
 * 项目代码大量使用旧 API，统一通过 GridLegacy 保持行为一致。
 * 迁移到新 API（size prop）后可以删除此组件。
 */
export { default } from "@mui/material/GridLegacy";
