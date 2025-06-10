"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Container,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Divider,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  Alert,
} from "@mui/material";
import {
  Person as PersonIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import TouchRipple from "@/components/TouchRipple";
import SwipeToDelete from "@/components/SwipeToDelete";
import PullToRefresh from "@/components/PullToRefresh";

// 模拟数据
const generateItems = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `项目 ${i + 1}`,
    description: `这是项目 ${i + 1} 的描述，用于测试滑动删除功能。`,
    avatar: `https://i.pravatar.cc/150?img=${i + 1}`,
  }));
};

export default function MobileDemo() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [items, setItems] = useState<any[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    // 初始加载数据
    setItems(generateItems(10));
  }, []);

  // 处理下拉刷新
  const handleRefresh = async () => {
    // 模拟网络请求延迟
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setItems(generateItems(10));
    setRefreshCount((prev) => prev + 1);

    // 显示刷新成功提示
    setAlertMessage(`刷新成功！这是第 ${refreshCount + 1} 次刷新`);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  // 处理删除项目
  const handleDelete = (id: number) => {
    setItems(items.filter((item) => item.id !== id));

    // 显示删除成功提示
    setAlertMessage(`已删除项目 ${id}`);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  return (
    <Box>
      <Navbar />
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            component={Link}
            href="/"
            startIcon={<ArrowBackIcon />}
            sx={{ mb: 2 }}
          >
            返回首页
          </Button>
        </Box>

        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{ fontSize: { xs: "1.5rem", md: "2.125rem" } }}
        >
          移动端交互示例
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          这个页面展示了为移动设备优化的交互组件，包括触摸反馈、滑动删除和下拉刷新。
          {isMobile
            ? " 您正在使用移动设备，可以直接体验这些交互。"
            : " 请在移动设备上查看或使用浏览器的移动设备模拟器来体验这些交互。"}
        </Typography>

        {showAlert && (
          <Alert
            severity="success"
            sx={{
              mb: 2,
              position: "fixed",
              top: 70,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1000,
              width: { xs: "calc(100% - 32px)", sm: "auto" },
            }}
          >
            {alertMessage}
          </Alert>
        )}

        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h5"
            gutterBottom
            sx={{ fontSize: { xs: "1.25rem", md: "1.5rem" } }}
          >
            1. 触摸反馈效果
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            点击下方按钮，体验自定义触摸反馈效果，提供更好的触摸体验。
          </Typography>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <TouchRipple
              color={theme.palette.primary.main}
              style={{ borderRadius: 8 }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: "center",
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  width: "100%",
                }}
              >
                点击我 - 主色调
              </Paper>
            </TouchRipple>

            <TouchRipple
              color={theme.palette.secondary.main}
              style={{ borderRadius: 8 }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: "center",
                  bgcolor: "secondary.main",
                  color: "secondary.contrastText",
                  width: "100%",
                }}
              >
                点击我 - 次要色调
              </Paper>
            </TouchRipple>

            <TouchRipple
              color={theme.palette.error.main}
              style={{ borderRadius: 8 }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  textAlign: "center",
                  bgcolor: "error.main",
                  color: "error.contrastText",
                  width: "100%",
                }}
              >
                点击我 - 错误色调
              </Paper>
            </TouchRipple>
          </Box>
        </Box>

        <Divider sx={{ my: 4 }} />

        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h5"
            gutterBottom
            sx={{ fontSize: { xs: "1.25rem", md: "1.5rem" } }}
          >
            2. 滑动删除功能
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            向左滑动列表项可以显示删除按钮。在移动设备上，这是一种常见且直观的删除操作方式。
          </Typography>

          <Paper
            elevation={0}
            sx={{
              bgcolor: "background.paper",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <List sx={{ width: "100%", p: 0 }}>
              {items.slice(0, 5).map((item) => (
                <Box key={item.id}>
                  <SwipeToDelete onDelete={() => handleDelete(item.id)}>
                    <ListItem
                      sx={{ px: { xs: 2, md: 3 }, py: { xs: 1.5, md: 2 } }}
                    >
                      <ListItemAvatar>
                        <Avatar src={item.avatar} alt={item.name}>
                          <PersonIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={item.name}
                        secondary={item.description}
                        primaryTypographyProps={{
                          fontSize: { xs: "0.9rem", md: "1rem" },
                        }}
                        secondaryTypographyProps={{
                          fontSize: { xs: "0.75rem", md: "0.875rem" },
                        }}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleDelete(item.id)}
                          sx={{ display: { xs: "none", md: "inline-flex" } }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  </SwipeToDelete>
                  {item.id < 5 && <Divider />}
                </Box>
              ))}
            </List>
          </Paper>
        </Box>

        <Divider sx={{ my: 4 }} />

        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h5"
            gutterBottom
            sx={{ fontSize: { xs: "1.25rem", md: "1.5rem" } }}
          >
            3. 下拉刷新功能
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            在移动设备上，向下拉动下面的卡片可以触发刷新操作。这是移动应用中常见的刷新内容的方式。
          </Typography>

          <PullToRefresh onRefresh={handleRefresh}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  可刷新内容
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  向下拉动此卡片可以刷新内容。当前刷新次数: {refreshCount}
                </Typography>

                <List sx={{ width: "100%", p: 0 }}>
                  {items.slice(5, 10).map((item) => (
                    <ListItem key={item.id} sx={{ px: 0, py: 1 }}>
                      <ListItemAvatar>
                        <Avatar
                          src={item.avatar}
                          alt={item.name}
                          sx={{ width: 40, height: 40 }}
                        >
                          <PersonIcon />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={item.name}
                        secondary={`ID: ${item.id}`}
                        primaryTypographyProps={{
                          fontSize: { xs: "0.9rem", md: "1rem" },
                        }}
                        secondaryTypographyProps={{
                          fontSize: { xs: "0.75rem", md: "0.875rem" },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </PullToRefresh>
        </Box>

        <Box sx={{ mt: 6, mb: 2, textAlign: "center" }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ArrowBackIcon />}
            component={Link}
            href="/"
            sx={{ mb: 2 }}
          >
            返回首页
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
