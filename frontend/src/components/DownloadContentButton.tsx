import React, { useState, useEffect } from "react";
import {
  Button,
  CircularProgress,
  Typography,
  Tooltip,
  IconButton,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Box,
} from "@mui/material";
import {
  Download as DownloadIcon,
  CloudDone as CloudDoneIcon,
  Delete as DeleteIcon,
  CloudOff as CloudOffIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import offlineManager from "@/utils/offlineManager";

interface DownloadContentButtonProps {
  // 学习路径ID
  pathId: string;
  // 章节ID（可选，如果未提供则下载整个学习路径）
  chapterId?: string;
  // 自定义样式
  sx?: any;
  // 是否使用IconButton而不是普通Button
  iconButton?: boolean;
  // 按钮大小
  size?: "small" | "medium" | "large";
  // 下载完成回调
  onDownloadComplete?: () => void;
  // 删除完成回调
  onDeleteComplete?: () => void;
  // 包含的子元素（通常是按钮文本）
  children?: React.ReactNode;
}

/**
 * 下载内容按钮组件
 * 允许用户下载学习路径或章节内容以供离线使用
 */
const DownloadContentButton: React.FC<DownloadContentButtonProps> = ({
  pathId,
  chapterId,
  sx = {},
  iconButton = false,
  size = "medium",
  onDownloadComplete,
  onDeleteComplete,
  children,
}) => {
  // 下载状态
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  // 下载进度
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  // 已下载状态
  const [isDownloaded, setIsDownloaded] = useState<boolean>(false);
  // 消息提示
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  // 消息类型
  const [snackbarSeverity, setSnackbarSeverity] = useState<
    "success" | "error" | "info" | "warning"
  >("success");
  // 是否显示消息
  const [showSnackbar, setShowSnackbar] = useState<boolean>(false);
  // 是否显示删除确认对话框
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);

  // 检查是否已下载
  const checkDownloadStatus = async () => {
    if (!offlineManager) return;

    try {
      // 如果提供了章节ID，检查章节是否已下载
      if (chapterId) {
        const isChapterDownloaded = await offlineManager.isChapterDownloaded(
          chapterId
        );
        setIsDownloaded(isChapterDownloaded);
      } else {
        // 否则检查整个学习路径是否已下载
        const isPathDownloaded = await offlineManager.isLearningPathDownloaded(
          pathId
        );
        setIsDownloaded(isPathDownloaded);
      }
    } catch (error) {
      console.error("检查下载状态失败:", error);
      setIsDownloaded(false);
    }
  };

  // 组件挂载时检查下载状态
  useEffect(() => {
    // 确保在客户端环境
    if (typeof window === "undefined" || !offlineManager) return;

    checkDownloadStatus();
  }, [pathId, chapterId]);

  // 处理下载
  const handleDownload = async () => {
    if (!offlineManager) {
      setSnackbarMessage(
        "离线功能不可用，请检查浏览器是否支持IndexedDB和Service Worker"
      );
      setSnackbarSeverity("error");
      setShowSnackbar(true);
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // 模拟下载进度（实际进度很难精确计算）
      const progressInterval = setInterval(() => {
        setDownloadProgress((prev) => {
          const newProgress = prev + Math.random() * 15;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 500);

      // 执行下载
      if (chapterId) {
        // 下载单个章节
        await offlineManager.downloadChapter(pathId, chapterId);
        setSnackbarMessage("章节已成功下载，可在离线模式下访问");
      } else {
        // 下载整个学习路径
        await offlineManager.downloadLearningPath(pathId);
        setSnackbarMessage(
          "学习路径及其所有章节已成功下载，可在离线模式下访问"
        );
      }

      // 清除进度模拟
      clearInterval(progressInterval);
      setDownloadProgress(100);
      setIsDownloaded(true);
      setSnackbarSeverity("success");
      setShowSnackbar(true);

      // 执行下载完成回调
      if (onDownloadComplete) {
        onDownloadComplete();
      }
    } catch (error) {
      console.error("下载内容失败:", error);
      setSnackbarMessage(
        `下载失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
      setSnackbarSeverity("error");
      setShowSnackbar(true);
    } finally {
      setIsDownloading(false);
    }
  };

  // 处理删除已下载内容
  const handleDelete = async () => {
    if (!offlineManager) return;

    setShowDeleteDialog(false);

    try {
      if (chapterId) {
        // 删除单个章节
        await offlineManager.deleteChapter(chapterId);
        setSnackbarMessage("章节已从离线存储中删除");
      } else {
        // 删除整个学习路径
        await offlineManager.deleteLearningPath(pathId);
        setSnackbarMessage("学习路径及其所有章节已从离线存储中删除");
      }

      setIsDownloaded(false);
      setSnackbarSeverity("info");
      setShowSnackbar(true);

      // 执行删除完成回调
      if (onDeleteComplete) {
        onDeleteComplete();
      }
    } catch (error) {
      console.error("删除内容失败:", error);
      setSnackbarMessage(
        `删除失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
      setSnackbarSeverity("error");
      setShowSnackbar(true);
    }
  };

  // 渲染下载进度
  const renderProgress = () => (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <CircularProgress
        variant="determinate"
        value={downloadProgress}
        size={24}
        sx={{ color: "primary.main" }}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: "absolute",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography
          variant="caption"
          component="div"
          color="text.secondary"
          sx={{ fontSize: "0.6rem" }}
        >
          {`${Math.round(downloadProgress)}%`}
        </Typography>
      </Box>
    </Box>
  );

  // 渲染按钮内容
  const renderButtonContent = () => {
    if (isDownloading) {
      return renderProgress();
    }

    if (isDownloaded) {
      return (
        <>
          <CloudDoneIcon sx={{ mr: iconButton ? 0 : 1 }} />
          {!iconButton && (children || "已下载")}
        </>
      );
    }

    if (navigator.onLine === false) {
      return (
        <>
          <CloudOffIcon sx={{ mr: iconButton ? 0 : 1 }} />
          {!iconButton && (children || "离线中")}
        </>
      );
    }

    return (
      <>
        <DownloadIcon sx={{ mr: iconButton ? 0 : 1 }} />
        {!iconButton && (children || "下载")}
      </>
    );
  };

  // 已下载状态下的删除按钮
  const renderDeleteButton = () => {
    if (!isDownloaded) return null;

    return (
      <Tooltip title="删除已下载内容">
        <IconButton
          size="small"
          color="default"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteDialog(true);
          }}
          sx={{ ml: 1 }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  };

  // 根据iconButton属性决定渲染普通按钮还是图标按钮
  if (iconButton) {
    return (
      <>
        <Tooltip
          title={
            isDownloaded
              ? "已下载"
              : isDownloading
              ? "下载中..."
              : "下载以供离线使用"
          }
        >
          <span>
            <IconButton
              onClick={isDownloaded ? undefined : handleDownload}
              disabled={isDownloading || navigator.onLine === false}
              color={isDownloaded ? "primary" : "default"}
              size={size}
              sx={sx}
            >
              {renderButtonContent()}
            </IconButton>
          </span>
        </Tooltip>

        {isDownloaded && (
          <Tooltip title="删除已下载内容">
            <IconButton
              size="small"
              color="default"
              onClick={() => setShowDeleteDialog(true)}
              sx={{ ml: 1 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        {/* 删除确认对话框 */}
        <Dialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
        >
          <DialogTitle>确认删除</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {chapterId
                ? "确定要删除此章节的离线内容吗？删除后将无法在离线状态下访问。"
                : "确定要删除此学习路径及其所有章节的离线内容吗？删除后将无法在离线状态下访问。"}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDeleteDialog(false)}>取消</Button>
            <Button
              onClick={handleDelete}
              color="error"
              startIcon={<DeleteIcon />}
            >
              删除
            </Button>
          </DialogActions>
        </Dialog>

        {/* 消息提示 */}
        <Snackbar
          open={showSnackbar}
          autoHideDuration={5000}
          onClose={() => setShowSnackbar(false)}
        >
          <Alert
            onClose={() => setShowSnackbar(false)}
            severity={snackbarSeverity}
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </>
    );
  }

  return (
    <>
      <Button
        variant={isDownloaded ? "outlined" : "contained"}
        color={isDownloaded ? "primary" : "primary"}
        startIcon={renderButtonContent()}
        endIcon={renderDeleteButton()}
        onClick={isDownloaded ? undefined : handleDownload}
        disabled={isDownloading || navigator.onLine === false}
        size={size}
        sx={{
          ...sx,
          opacity: isDownloaded ? 0.8 : 1,
        }}
      >
        {isDownloading
          ? "下载中..."
          : isDownloaded
          ? children || "已下载"
          : children || "下载以供离线使用"}
      </Button>

      {/* 删除确认对话框 */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
      >
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {chapterId
              ? "确定要删除此章节的离线内容吗？删除后将无法在离线状态下访问。"
              : "确定要删除此学习路径及其所有章节的离线内容吗？删除后将无法在离线状态下访问。"}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>取消</Button>
          <Button
            onClick={handleDelete}
            color="error"
            startIcon={<DeleteIcon />}
          >
            删除
          </Button>
        </DialogActions>
      </Dialog>

      {/* 消息提示 */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={5000}
        onClose={() => setShowSnackbar(false)}
      >
        <Alert
          onClose={() => setShowSnackbar(false)}
          severity={snackbarSeverity}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default DownloadContentButton;
