'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Button,
  Chip,
  LinearProgress,
  IconButton
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import Link from 'next/link';

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
  variant?: 'standard' | 'featured';
  color?: string;
}

const LearningPathCard: React.FC<LearningPathCardProps> = ({
  path,
  onMenuOpen,
  variant = 'standard',
  color = '#4285F4'
}) => {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        transition: 'all 0.2s ease-in-out',
        boxShadow: '0 1px 2px 0 rgba(60,64,67,.3), 0 1px 3px 1px rgba(60,64,67,.15)',
        '&:hover': {
          boxShadow: '0 1px 3px 0 rgba(60,64,67,.3), 0 4px 8px 3px rgba(60,64,67,.15)',
          transform: 'translateY(-2px)'
        }
      }}
    >
      <Box
        sx={{
          height: 8,
          bgcolor: color,
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8
        }}
      />
      <CardContent sx={{ flexGrow: 1, pt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography
            gutterBottom
            variant="h6"
            component="h2"
            sx={{
              fontWeight: 500,
              color: '#202124',
              fontSize: '1.1rem'
            }}
          >
            {path.title}
          </Typography>
          <IconButton
            size="small"
            onClick={(e) => onMenuOpen(e, path.id)}
            sx={{ color: '#5F6368' }}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>
        <Typography
          variant="body2"
          sx={{
            color: '#5F6368',
            mb: 2,
            height: 60,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {path.description}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            mb: 2,
            flexWrap: 'wrap'
          }}
        >
          <Chip
            label={`难度: ${path.level}`}
            size="small"
            sx={{
              bgcolor: variant === 'featured' ? '#FEF7E0' : '#E8F0FE',
              color: variant === 'featured' ? '#EA8600' : '#4285F4',
              fontWeight: 500,
              fontSize: '0.75rem'
            }}
          />
          <Chip
            label={`${path.chapters} 章节`}
            size="small"
            sx={{
              bgcolor: '#E6F4EA',
              color: '#34A853',
              fontWeight: 500,
              fontSize: '0.75rem'
            }}
          />
        </Box>
        {path.progress !== undefined && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#202124' }}>
                学习进度
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, color }}>
                {path.progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={path.progress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: '#E8EAED',
                '& .MuiLinearProgress-bar': {
                  bgcolor: path.progress < 30 ? '#FBBC04' :
                    path.progress < 70 ? '#4285F4' : '#34A853',
                  borderRadius: 4
                }
              }}
            />
          </Box>
        )}
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
        <Button
          variant="contained"
          disableElevation
          size="medium"
          color="primary"
          component={Link}
          href={`/learning-paths/${path.id}/chapters/1`}
          sx={{
            borderRadius: 6,
            textTransform: 'none',
            fontWeight: 500,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 1px 2px 0 rgba(60,64,67,.3)'
            }
          }}
          endIcon={<ArrowForwardIcon />}
        >
          {path.progress ? '继续学习' : '开始学习'}
        </Button>
        <Button
          variant="text"
          size="medium"
          color="primary"
          component={Link}
          href={`/learning-paths/${path.id}`}
          sx={{
            borderRadius: 6,
            textTransform: 'none',
            fontWeight: 500
          }}
        >
          查看详情
        </Button>
      </CardActions>
    </Card>
  );
};

export default LearningPathCard;
