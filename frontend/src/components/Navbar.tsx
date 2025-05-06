'use client';

import { useState } from 'react';
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
  useTheme
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Home as HomeIcon, 
  School as SchoolIcon, 
  Book as BookIcon, 
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavbarProps {
  isLoggedIn?: boolean;
  userName?: string;
  userAvatar?: string;
  onLogout?: () => void;
}

export default function Navbar({ isLoggedIn = false, userName = '', userAvatar = '', onLogout }: NavbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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
    if (onLogout) onLogout();
  };

  const menuItems = [
    { text: '首页', icon: <HomeIcon />, href: '/' },
    { text: '学习路径', icon: <SchoolIcon />, href: '/learning-paths' },
    { text: '我的学习', icon: <BookIcon />, href: '/my-learning' },
  ];

  const drawer = (
    <Box sx={{ width: 250 }} role="presentation" onClick={handleDrawerToggle}>
      <List>
        {menuItems.map((item) => (
          <ListItem 
            key={item.text} 
            component={Link} 
            href={item.href}
            selected={pathname === item.href}
            sx={{ 
              color: 'inherit', 
              textDecoration: 'none',
              bgcolor: pathname === item.href ? 'rgba(66, 133, 244, 0.08)' : 'transparent',
              '&:hover': {
                bgcolor: 'rgba(66, 133, 244, 0.04)',
              }
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="static" color="default" elevation={1} sx={{ bgcolor: 'white' }}>
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
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
              color: 'primary.main', 
              textDecoration: 'none',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <SchoolIcon />
            Study With Me
          </Typography>
          
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              {menuItems.map((item) => (
                <Button 
                  key={item.text}
                  component={Link}
                  href={item.href}
                  color={pathname === item.href ? 'primary' : 'inherit'}
                  sx={{ 
                    fontWeight: pathname === item.href ? 500 : 400,
                    borderRadius: 2,
                    px: 2
                  }}
                  startIcon={item.icon}
                >
                  {item.text}
                </Button>
              ))}
            </Box>
          )}
          
          {isLoggedIn ? (
            <Box sx={{ ml: 2 }}>
              <IconButton
                onClick={handleMenuOpen}
                size="small"
                aria-controls="menu-appbar"
                aria-haspopup="true"
              >
                {userAvatar ? (
                  <Avatar src={userAvatar} alt={userName} sx={{ width: 32, height: 32 }} />
                ) : (
                  <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                    {userName.charAt(0).toUpperCase()}
                  </Avatar>
                )}
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem disabled>
                  <Typography variant="body2">{userName}</Typography>
                </MenuItem>
                <Divider />
                <MenuItem component={Link} href="/profile" onClick={handleMenuClose}>
                  <ListItemIcon>
                    <AccountCircleIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="个人资料" />
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="退出登录" />
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                component={Link} 
                href="/login" 
                color="inherit"
                variant="text"
              >
                登录
              </Button>
              <Button 
                component={Link} 
                href="/register" 
                color="primary"
                variant="contained"
                disableElevation
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
      >
        {drawer}
      </Drawer>
    </>
  );
}
