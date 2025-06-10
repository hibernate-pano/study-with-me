"use client";

import { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
  ListItemButton,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  School as SchoolIcon,
  Book as BookIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  QuestionAnswer as QuestionAnswerIcon,
  Leaderboard as LeaderboardIcon,
  TouchApp as TouchAppIcon,
} from "@mui/icons-material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface NavbarProps {
  // 可选的额外属性
}

export default function Navbar({}: NavbarProps = {}) {
  // 使用认证上下文
  const { user, isAuthenticated, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isSmallMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const pathname = usePathname();

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  const menuItems = [
    { text: "首页", icon: <HomeIcon />, href: "/" },
    { text: "学习路径", icon: <SchoolIcon />, href: "/learning-paths" },
    { text: "AI辅导", icon: <QuestionAnswerIcon />, href: "/ai-tutor" },
    {
      text: "排行榜",
      icon: <LeaderboardIcon />,
      href: "/leaderboard",
      requireAuth: true,
    },
    { text: "移动端演示", icon: <TouchAppIcon />, href: "/mobile-demo" },
  ];

  const drawer = (
    <Box sx={{ width: 250 }} role="presentation">
      <List>
        {menuItems.map((item) => {
          // 如果需要认证且用户未登录，则不显示该菜单项
          if (item.requireAuth && !isAuthenticated) {
            return null;
          }

          return (
            <ListItemButton
              key={item.text}
              component={Link}
              href={item.href}
              selected={pathname === item.href}
              onClick={handleDrawerToggle}
              sx={{
                color: "inherit",
                textDecoration: "none",
                py: 1.5, // 增加垂直内边距，提供更大的触摸区域
                bgcolor:
                  pathname === item.href
                    ? "rgba(66, 133, 244, 0.08)"
                    : "transparent",
                "&:hover": {
                  bgcolor: "rgba(66, 133, 244, 0.04)",
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          );
        })}
      </List>
      <Divider sx={{ my: 1 }} />
      {isAuthenticated ? (
        <List>
          <ListItemButton
            component={Link}
            href="/profile"
            onClick={handleDrawerToggle}
            sx={{ py: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <AccountCircleIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="个人资料" />
          </ListItemButton>
          <ListItemButton
            onClick={() => {
              handleDrawerToggle();
              logout();
            }}
            sx={{ py: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="退出登录" />
          </ListItemButton>
        </List>
      ) : (
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          <Button
            component={Link}
            href="/login"
            color="inherit"
            variant="outlined"
            fullWidth
            onClick={handleDrawerToggle}
            sx={{ py: 1 }}
          >
            登录
          </Button>
          <Button
            component={Link}
            href="/register"
            color="primary"
            variant="contained"
            fullWidth
            onClick={handleDrawerToggle}
            sx={{ py: 1 }}
          >
            注册
          </Button>
        </Box>
      )}
    </Box>
  );

  return (
    <>
      <AppBar
        position="static"
        color="default"
        elevation={1}
        sx={{ bgcolor: "white" }}
      >
        <Toolbar sx={{ py: { xs: 0.5, md: 0 } }}>
          {" "}
          {/* 移动端增加垂直内边距 */}
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1.5 }}
              size={isSmallMobile ? "small" : "medium"}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            component={Link}
            href="/"
            sx={{
              flexGrow: 1,
              color: "primary.main",
              textDecoration: "none",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 1,
              fontSize: { xs: "1rem", sm: "1.25rem" }, // 响应式字体大小
            }}
          >
            <SchoolIcon sx={{ fontSize: { xs: "1.25rem", sm: "1.5rem" } }} />
            Study With Me
          </Typography>
          {!isMobile && (
            <Box sx={{ display: "flex", gap: 2 }}>
              {menuItems.map((item) => {
                // 如果需要认证且用户未登录，则不显示该菜单项
                if (item.requireAuth && !isAuthenticated) {
                  return null;
                }

                return (
                  <Button
                    key={item.text}
                    component={Link}
                    href={item.href}
                    color={pathname === item.href ? "primary" : "inherit"}
                    sx={{
                      fontWeight: pathname === item.href ? 500 : 400,
                      borderRadius: 2,
                      px: 2,
                    }}
                    startIcon={item.icon}
                  >
                    {item.text}
                  </Button>
                );
              })}
            </Box>
          )}
          {isAuthenticated ? (
            <Box sx={{ ml: 2 }}>
              <IconButton
                onClick={handleMenuOpen}
                size="small"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                sx={{ p: { xs: 0.5, md: 1 } }} // 移动端减小内边距
              >
                {user?.avatar_url ? (
                  <Avatar
                    src={user.avatar_url}
                    alt={user.display_name || user.email}
                    sx={{
                      width: { xs: 28, md: 32 },
                      height: { xs: 28, md: 32 },
                    }}
                  />
                ) : (
                  <Avatar
                    sx={{
                      width: { xs: 28, md: 32 },
                      height: { xs: 28, md: 32 },
                      bgcolor: "primary.main",
                    }}
                  >
                    {(user?.display_name || user?.email || "")
                      .charAt(0)
                      .toUpperCase()}
                  </Avatar>
                )}
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                  sx: { minWidth: "200px" },
                }}
              >
                <MenuItem disabled>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: { xs: "0.75rem", md: "0.875rem" } }}
                  >
                    {user?.display_name || user?.email}
                  </Typography>
                </MenuItem>
                <Divider />
                <MenuItem
                  component={Link}
                  href="/profile"
                  onClick={handleMenuClose}
                  sx={{ py: 1.5 }}
                >
                  <ListItemIcon>
                    <AccountCircleIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="个人资料" />
                </MenuItem>
                <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="退出登录" />
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <Box sx={{ display: "flex", gap: { xs: 0.5, md: 1 } }}>
              <Button
                component={Link}
                href="/login"
                color="inherit"
                variant="text"
                sx={{
                  fontSize: { xs: "0.75rem", md: "0.875rem" },
                  py: { xs: 0.5, md: 0.75 },
                  px: { xs: 1, md: 1.5 },
                }}
              >
                登录
              </Button>
              <Button
                component={Link}
                href="/register"
                color="primary"
                variant="contained"
                disableElevation
                sx={{
                  fontSize: { xs: "0.75rem", md: "0.875rem" },
                  py: { xs: 0.5, md: 0.75 },
                  px: { xs: 1, md: 1.5 },
                }}
              >
                注册
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        sx={{
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: { xs: "80%", sm: 250 },
          },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}
