"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Avatar,
  Divider,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from "@mui/material";
import {
  Save as SaveIcon,
  Person as PersonIcon,
  EmojiEvents as EmojiEventsIcon,
  BarChart as BarChartIcon,
  LocalFireDepartment as FireIcon,
  CalendarMonth as CalendarIcon,
} from "@mui/icons-material";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import LearningStatistics from "@/components/LearningStatistics";
import AchievementsList from "@/components/AchievementsList";
import LearningStreak from "@/components/LearningStreak";
import LearningHeatmap from "@/components/charts/LearningHeatmap";
import {
  LearningStatisticsSkeleton,
  LearningHeatmapSkeleton,
} from "@/components/SkeletonLoaders";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const [profileData, setProfileData] = useState({
    displayName: "",
    email: "",
    bio: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (user) {
      setProfileData({
        displayName: user.display_name || "",
        email: user.email || "",
        bio: "",
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData({
      ...profileData,
      [name]: value,
    });
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsUpdating(true);
    setError("");
    setSuccess("");

    try {
      // 在实际应用中，这里会调用API更新用户资料
      // const response = await api.updateProfile(profileData);

      // 模拟API调用
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setSuccess("个人资料更新成功");
    } catch (err: any) {
      console.error("更新失败:", err);
      setError(err.message || "更新失败，请稍后再试");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <ProtectedRoute>
      <Box>
        <Navbar />

        <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
          <Paper sx={{ p: 0, borderRadius: 2, overflow: "hidden" }}>
            <Box
              sx={{
                bgcolor: "primary.main",
                color: "white",
                p: 3,
                display: "flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: "white",
                  color: "primary.main",
                }}
              >
                <PersonIcon sx={{ fontSize: 40 }} />
              </Avatar>
              <Box>
                <Typography variant="h5" fontWeight={500}>
                  {isLoading
                    ? "加载中..."
                    : profileData.displayName || user?.email}
                </Typography>
                <Typography variant="body2">
                  {isLoading ? "" : user?.email}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="profile tabs"
              >
                <Tab
                  label="个人资料"
                  icon={<PersonIcon />}
                  iconPosition="start"
                />
                <Tab
                  label="学习统计"
                  icon={<BarChartIcon />}
                  iconPosition="start"
                />
                <Tab
                  label="学习热图"
                  icon={<CalendarIcon />}
                  iconPosition="start"
                />
                <Tab
                  label="我的成就"
                  icon={<EmojiEventsIcon />}
                  iconPosition="start"
                />
                <Tab
                  label="连续学习"
                  icon={<FireIcon />}
                  iconPosition="start"
                />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  {success}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="显示名称"
                      name="displayName"
                      value={profileData.displayName}
                      onChange={handleChange}
                      disabled={isUpdating}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="邮箱地址"
                      name="email"
                      value={profileData.email}
                      disabled={true}
                      helperText="邮箱地址不可修改"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="个人简介"
                      name="bio"
                      value={profileData.bio}
                      onChange={handleChange}
                      multiline
                      rows={4}
                      disabled={isUpdating}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isUpdating}
                      startIcon={
                        isUpdating ? (
                          <CircularProgress size={20} color="inherit" />
                        ) : (
                          <SaveIcon />
                        )
                      }
                    >
                      {isUpdating ? "保存中..." : "保存更改"}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {isLoading ? (
                <LearningStatisticsSkeleton />
              ) : (
                <LearningStatistics />
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              {isLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <LearningHeatmap />
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              {isLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <AchievementsList
                  userId={user?.id}
                  showLockedAchievements={true}
                />
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={4}>
              {isLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <LearningStreak userId={user?.id} />
              )}
            </TabPanel>
          </Paper>
        </Container>
      </Box>
    </ProtectedRoute>
  );
}
