"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  MoreVert as MoreVertIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import Link from "next/link";

interface LearningPath {
  id: string;
  title: string;
  description: string;
  goal?: string;
  level: string;
  chapters: number;
  created_at?: string;
  progress?: number;
  users?: number;
}

interface LearningPathCardProps {
  path: LearningPath;
  onMenuOpen: (event: React.MouseEvent<HTMLElement>, pathId: string) => void;
  variant?: "standard" | "featured";
  color?: string;
}

const LearningPathCard: React.FC<LearningPathCardProps> = ({
  path,
  onMenuOpen,
  variant = "standard",
  color = "#4285F4",
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        transition: "all 0.2s ease-in-out",
        boxShadow:
          "0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)",
        "&:hover": {
          boxShadow:
            "0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)",
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box
        sx={{
          height: 8,
          bgcolor: color,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
        }}
      />
      <CardContent
        sx={{
          flexGrow: 1,
          pt: 2,
          px: { xs: 2, md: 3 }, // 响应式水平内边距
          pb: { xs: 1.5, md: 2 }, // 响应式底部内边距
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Typography
            gutterBottom
            variant="h6"
            component="h2"
            sx={{
              fontWeight: 500,
              color: "#202124",
              fontSize: { xs: "1rem", md: "1.1rem" }, // 响应式字体大小
              lineHeight: 1.3,
            }}
          >
            {path.title}
          </Typography>
          <IconButton
            size="small"
            onClick={(e) => onMenuOpen(e, path.id)}
            sx={{
              color: "#5F6368",
              p: { xs: 0.5, md: 1 }, // 响应式内边距
              ml: 1,
              "&:hover": { bgcolor: "rgba(0, 0, 0, 0.04)" },
            }}
            aria-label="更多选项"
          >
            <MoreVertIcon fontSize={isMobile ? "small" : "medium"} />
          </IconButton>
        </Box>
        <Typography
          variant="body2"
          sx={{
            color: "#5F6368",
            mb: 2,
            height: { xs: 54, md: 60 }, // 响应式高度
            fontSize: { xs: "0.75rem", md: "0.875rem" }, // 响应式字体大小
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {path.description}
        </Typography>
        <Box
          sx={{
            display: "flex",
            gap: { xs: 0.5, md: 1 }, // 响应式间距
            mb: 2,
            flexWrap: "wrap",
          }}
        >
          <Chip
            label={`难度: ${path.level}`}
            size="small"
            sx={{
              bgcolor: variant === "featured" ? "#FEF7E0" : "#E8F0FE",
              color: variant === "featured" ? "#EA8600" : "#4285F4",
              fontWeight: 500,
              fontSize: { xs: "0.7rem", md: "0.75rem" }, // 响应式字体大小
              height: { xs: 22, md: 24 }, // 响应式高度
              "& .MuiChip-label": {
                px: { xs: 1, md: 1.5 }, // 响应式水平内边距
              },
            }}
          />
          <Chip
            label={`${path.chapters} 章节`}
            size="small"
            sx={{
              bgcolor: "#E6F4EA",
              color: "#34A853",
              fontWeight: 500,
              fontSize: { xs: "0.7rem", md: "0.75rem" }, // 响应式字体大小
              height: { xs: 22, md: 24 }, // 响应式高度
              "& .MuiChip-label": {
                px: { xs: 1, md: 1.5 }, // 响应式水平内边距
              },
            }}
          />
        </Box>
        {path.progress !== undefined && (
          <Box sx={{ mt: { xs: 1.5, md: 2 } }}>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color: "#202124",
                  fontSize: { xs: "0.7rem", md: "0.75rem" }, // 响应式字体大小
                }}
              >
                学习进度
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  color,
                  fontSize: { xs: "0.7rem", md: "0.75rem" }, // 响应式字体大小
                }}
              >
                {path.progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={path.progress}
              sx={{
                height: { xs: 6, md: 8 }, // 响应式高度
                borderRadius: 4,
                bgcolor: "#E8EAED",
                "& .MuiLinearProgress-bar": {
                  bgcolor:
                    path.progress < 30
                      ? "#FBBC04"
                      : path.progress < 70
                      ? "#4285F4"
                      : "#34A853",
                  borderRadius: 4,
                },
              }}
            />
          </Box>
        )}
      </CardContent>
      <CardActions
        sx={{
          p: { xs: 1.5, md: 2 }, // 响应式内边距
          pt: { xs: 0, md: 0 },
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Button
          variant="contained"
          disableElevation
          size={isMobile ? "small" : "medium"}
          color="primary"
          component={Link}
          href={`/learning-paths/${path.id}/chapters/1`}
          sx={{
            borderRadius: 6,
            textTransform: "none",
            fontWeight: 500,
            boxShadow: "none",
            py: { xs: 0.75, md: 1 }, // 响应式垂直内边距
            px: { xs: 1.5, md: 2 }, // 响应式水平内边距
            minWidth: { xs: "90px", md: "auto" }, // 确保在移动端有足够的触摸区域
            fontSize: { xs: "0.75rem", md: "0.875rem" }, // 响应式字体大小
            "&:hover": {
              boxShadow: "0 1px 2px 0 rgba(60,64,67,.3)",
            },
          }}
          endIcon={
            <ArrowForwardIcon fontSize={isMobile ? "small" : "medium"} />
          }
        >
          {path.progress ? "继续学习" : "开始学习"}
        </Button>
        <Button
          variant="text"
          size={isMobile ? "small" : "medium"}
          color="primary"
          component={Link}
          href={`/learning-paths/${path.id}`}
          sx={{
            borderRadius: 6,
            textTransform: "none",
            fontWeight: 500,
            py: { xs: 0.75, md: 1 }, // 响应式垂直内边距
            px: { xs: 1.5, md: 2 }, // 响应式水平内边距
            minWidth: { xs: "80px", md: "auto" }, // 确保在移动端有足够的触摸区域
            fontSize: { xs: "0.75rem", md: "0.875rem" }, // 响应式字体大小
          }}
        >
          查看详情
        </Button>
      </CardActions>
    </Card>
  );
};

export default LearningPathCard;
