import React, { useState, useEffect } from "react";
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Badge,
  Box,
  Typography,
  Tooltip,
} from "@mui/material";
import {
  WifiOff as WifiOffIcon,
  Wifi as WifiIcon,
  SyncProblem as SyncProblemIcon,
} from "@mui/icons-material";
import offlineManager from "@/utils/offlineManager";

/**
 * 离线通知组件，在用户离线时提供视觉反馈
 */
const OfflineNotification: React.FC = () => {
  // 离线状态
  const [isOffline, setIsOffline] = useState<boolean>(false);
  // Snackbar显示状态
  const [showSnackbar, setShowSnackbar] = useState<boolean>(false);
  // 是否有待同步数据
  const [hasPendingSync, setHasPendingSync] = useState<boolean>(false);

  // 监听离线状态变化
  useEffect(() => {
    // 确保在客户端环境
    if (typeof window === "undefined" || !offlineManager) return;

    // 初始化离线管理器
    offlineManager.init().catch((err) => {
      console.error("初始化离线管理器失败:", err);
    });

    // 添加离线状态监听器
    const unsubscribe = offlineManager.addOfflineListener((offline) => {
      // 如果离线状态发生变化，更新状态并显示通知
      if (offline !== isOffline) {
        setIsOffline(offline);
        setShowSnackbar(true);
      }
    });

    // 清理函数
    return () => {
      unsubscribe();
    };
  }, [isOffline]);

  // 关闭Snackbar
  const handleClose = () => {
    setShowSnackbar(false);
  };

  // 重试连接
  const handleRetry = () => {
    if (navigator.onLine) {
      setIsOffline(false);
      setShowSnackbar(false);
      // 如果有待同步数据，尝试同步
      if (hasPendingSync && offlineManager) {
        offlineManager.syncPendingData().catch((err) => {
          console.error("同步数据失败:", err);
        });
      }
    } else {
      // 如果仍然离线，显示提示
      setShowSnackbar(true);
    }
  };

  return (
    <>
      {/* 离线状态指示器 */}
      {isOffline && (
        <Tooltip title="您当前处于离线模式">
          <Badge
            color="error"
            variant="dot"
            sx={{
              position: "fixed",
              bottom: 16,
              right: 16,
              zIndex: 1000,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "error.main",
                color: "white",
                borderRadius: "50%",
                width: 40,
                height: 40,
                boxShadow: 3,
                cursor: "pointer",
              }}
              onClick={() => setShowSnackbar(true)}
            >
              <WifiOffIcon />
            </Box>
          </Badge>
        </Tooltip>
      )}

      {/* 离线状态通知 */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={isOffline ? null : 5000} // 离线状态下不自动关闭
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={isOffline ? "warning" : "success"}
          onClose={handleClose}
          sx={{ width: "100%", mb: 2 }}
          action={
            isOffline ? (
              <Button color="inherit" size="small" onClick={handleRetry}>
                重试
              </Button>
            ) : null
          }
          icon={isOffline ? <WifiOffIcon /> : <WifiIcon />}
        >
          <AlertTitle>{isOffline ? "您已离线" : "已恢复连接"}</AlertTitle>
          {isOffline ? (
            <Typography variant="body2">
              您当前处于离线模式。已下载的内容仍然可以访问，但某些功能可能受限。
            </Typography>
          ) : (
            <Typography variant="body2">
              网络连接已恢复，所有功能现在可用。
            </Typography>
          )}
          {hasPendingSync && (
            <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
              <SyncProblemIcon
                color="warning"
                sx={{ mr: 1, fontSize: "1rem" }}
              />
              <Typography variant="body2">有未同步的数据等待上传</Typography>
            </Box>
          )}
        </Alert>
      </Snackbar>
    </>
  );
};

export default OfflineNotification;
