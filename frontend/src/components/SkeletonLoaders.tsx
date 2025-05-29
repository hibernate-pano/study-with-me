"use client";

import { Box, Skeleton, Card, CardContent, Grid, Paper } from "@mui/material";

/**
 * 章节内容骨架屏
 */
export function ChapterContentSkeleton() {
  return (
    <Box sx={{ p: 3 }}>
      <Skeleton variant="rectangular" height={40} width="60%" sx={{ mb: 2 }} />
      <Skeleton variant="rectangular" height={20} width="90%" sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" height={20} width="85%" sx={{ mb: 1 }} />
      <Skeleton variant="rectangular" height={20} width="80%" sx={{ mb: 3 }} />

      {/* 概念块骨架 */}
      {[1, 2, 3].map((i) => (
        <Box key={i} sx={{ mb: 4 }}>
          <Skeleton
            variant="rectangular"
            height={30}
            width="40%"
            sx={{ mb: 2 }}
          />
          <Skeleton
            variant="rectangular"
            height={20}
            width="95%"
            sx={{ mb: 1 }}
          />
          <Skeleton
            variant="rectangular"
            height={20}
            width="90%"
            sx={{ mb: 1 }}
          />
          <Skeleton
            variant="rectangular"
            height={20}
            width="92%"
            sx={{ mb: 1 }}
          />
          <Skeleton
            variant="rectangular"
            height={20}
            width="88%"
            sx={{ mb: 1 }}
          />

          {/* 代码块骨架 */}
          {i === 2 && (
            <Box
              sx={{ mt: 2, mb: 2, bgcolor: "grey.100", p: 2, borderRadius: 1 }}
            >
              <Skeleton
                variant="rectangular"
                height={20}
                width="95%"
                sx={{ mb: 1 }}
              />
              <Skeleton
                variant="rectangular"
                height={20}
                width="90%"
                sx={{ mb: 1 }}
              />
              <Skeleton
                variant="rectangular"
                height={20}
                width="85%"
                sx={{ mb: 1 }}
              />
              <Skeleton
                variant="rectangular"
                height={20}
                width="92%"
                sx={{ mb: 1 }}
              />
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

/**
 * 学习路径卡片骨架屏
 */
export function LearningPathCardSkeleton() {
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Skeleton variant="rectangular" height={140} />
      <CardContent sx={{ flexGrow: 1 }}>
        <Skeleton
          variant="rectangular"
          height={28}
          width="80%"
          sx={{ mb: 1 }}
        />
        <Skeleton
          variant="rectangular"
          height={20}
          width="60%"
          sx={{ mb: 2 }}
        />
        <Skeleton
          variant="rectangular"
          height={20}
          width="100%"
          sx={{ mb: 1 }}
        />
        <Skeleton
          variant="rectangular"
          height={20}
          width="95%"
          sx={{ mb: 1 }}
        />
        <Skeleton
          variant="rectangular"
          height={20}
          width="90%"
          sx={{ mb: 2 }}
        />
        <Skeleton
          variant="rectangular"
          height={10}
          width="70%"
          sx={{ mb: 1 }}
        />
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}>
          <Skeleton variant="rectangular" height={36} width="48%" />
          <Skeleton variant="rectangular" height={36} width="48%" />
        </Box>
      </CardContent>
    </Card>
  );
}

/**
 * 学习热图骨架屏
 */
export function LearningHeatmapSkeleton() {
  return (
    <Paper sx={{ p: 3, borderRadius: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Skeleton variant="text" width={120} height={32} />
        <Skeleton
          variant="rectangular"
          width={120}
          height={40}
          sx={{ borderRadius: 1 }}
        />
      </Box>

      <Box sx={{ mt: 3 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {Array.from({ length: 30 }, (_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              width={14}
              height={14}
              sx={{ borderRadius: 0.5, opacity: 0.7 - (i % 4) * 0.1 }}
            />
          ))}
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            mt: 1,
          }}
        >
          <Skeleton variant="text" width={20} />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              width={14}
              height={14}
              sx={{ mx: 0.25, borderRadius: 0.5 }}
            />
          ))}
          <Skeleton variant="text" width={20} />
        </Box>
      </Box>
    </Paper>
  );
}

/**
 * 学习统计骨架屏
 */
export function LearningStatisticsSkeleton() {
  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Paper
            key={i}
            sx={{
              p: 2,
              borderRadius: 2,
              flex: "1 1 200px",
              minWidth: {
                xs: "100%",
                sm: "calc(50% - 8px)",
                md: "calc(25% - 12px)",
              },
            }}
          >
            <Skeleton variant="text" width={120} height={24} />
            <Skeleton variant="text" width={80} height={40} sx={{ mt: 1 }} />
            <Skeleton variant="text" width={160} height={20} sx={{ mt: 1 }} />
          </Paper>
        ))}
      </Box>

      <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Skeleton variant="text" width={160} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 1 }} />
      </Paper>

      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Skeleton variant="text" width={140} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      </Paper>
    </Box>
  );
}

/**
 * AI辅导骨架屏
 */
export function AITutorSkeleton() {
  return (
    <Box sx={{ p: 2 }}>
      <Skeleton variant="rectangular" height={30} width="40%" sx={{ mb: 2 }} />
      <Box sx={{ mb: 2 }}>
        <Skeleton
          variant="circular"
          width={40}
          height={40}
          sx={{ mr: 1, float: "left" }}
        />
        <Box sx={{ ml: 6 }}>
          <Skeleton
            variant="rectangular"
            height={20}
            width="90%"
            sx={{ mb: 1 }}
          />
          <Skeleton
            variant="rectangular"
            height={20}
            width="85%"
            sx={{ mb: 1 }}
          />
          <Skeleton variant="rectangular" height={20} width="70%" />
        </Box>
      </Box>
      <Box sx={{ mb: 2, mt: 3 }}>
        <Skeleton
          variant="circular"
          width={40}
          height={40}
          sx={{ mr: 1, float: "right" }}
        />
        <Box sx={{ mr: 6, textAlign: "right" }}>
          <Skeleton
            variant="rectangular"
            height={20}
            width="80%"
            sx={{ mb: 1, ml: "auto" }}
          />
          <Skeleton
            variant="rectangular"
            height={20}
            width="60%"
            sx={{ ml: "auto" }}
          />
        </Box>
      </Box>
      <Box sx={{ mt: 4 }}>
        <Skeleton variant="rectangular" height={56} width="100%" />
      </Box>
    </Box>
  );
}
