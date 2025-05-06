'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  contentId: string;
  contentType: 'chapter' | 'exercise';
  onSubmit: (data: any) => Promise<void>;
}

export default function FeedbackDialog({
  open,
  onClose,
  contentId,
  contentType,
  onSubmit
}: FeedbackDialogProps) {
  const [feedbackType, setFeedbackType] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!feedbackType) {
      setError('请选择反馈类型');
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      await onSubmit({
        contentId,
        contentType,
        feedbackType,
        feedbackText
      });
      
      setSuccess(true);
      
      // 重置表单
      setTimeout(() => {
        setFeedbackType('');
        setFeedbackText('');
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || '提交反馈失败，请稍后再试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setFeedbackType('');
      setFeedbackText('');
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>内容反馈</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            感谢您的反馈！我们会认真考虑您的建议，不断改进内容质量。
          </Alert>
        )}
        
        <Typography variant="body2" color="text.secondary" paragraph>
          您的反馈对我们非常重要，它将帮助我们不断改进学习内容的质量。
        </Typography>
        
        <FormControl component="fieldset" sx={{ mb: 2, width: '100%' }}>
          <FormLabel component="legend">反馈类型</FormLabel>
          <RadioGroup
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value)}
          >
            <FormControlLabel value="unclear" control={<Radio />} label="内容不清晰" />
            <FormControlLabel value="inaccurate" control={<Radio />} label="内容不准确" />
            <FormControlLabel value="incomplete" control={<Radio />} label="内容不完整" />
            <FormControlLabel value="tooComplex" control={<Radio />} label="内容过于复杂" />
            <FormControlLabel value="tooSimple" control={<Radio />} label="内容过于简单" />
            <FormControlLabel value="other" control={<Radio />} label="其他问题" />
          </RadioGroup>
        </FormControl>
        
        <TextField
          label="详细反馈"
          multiline
          rows={4}
          fullWidth
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="请详细描述您的反馈，以便我们更好地理解和改进..."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting || success}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
        >
          {isSubmitting ? '提交中...' : '提交反馈'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
