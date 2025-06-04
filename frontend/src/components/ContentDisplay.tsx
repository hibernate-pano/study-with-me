"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Divider,
  Chip,
  Button,
  Collapse,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  ContentCopy as ContentCopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Lightbulb as LightbulbIcon,
  Code as CodeIcon,
} from "@mui/icons-material";
import ReactMarkdown from "react-markdown";

interface CodeBlockProps {
  code: string;
  title?: string;
  language?: string;
}

/**
 * 增强的代码块组件
 */
export function EnhancedCodeBlock({
  code,
  title,
  language = "javascript",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card sx={{ mb: 3, borderRadius: 2, overflow: "visible" }}>
      {title && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            bgcolor: "grey.800",
            color: "white",
            py: 1,
            px: 2,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <CodeIcon sx={{ mr: 1, fontSize: 18 }} />
            <Typography variant="subtitle2">{title}</Typography>
          </Box>
          <Chip
            label={language}
            size="small"
            sx={{
              bgcolor: "primary.dark",
              color: "white",
              height: 24,
              "& .MuiChip-label": { px: 1, py: 0.5, fontSize: "0.7rem" },
            }}
          />
        </Box>
      )}
      <Paper
        sx={{
          p: 2,
          bgcolor: "grey.900",
          color: "grey.100",
          borderRadius: title ? 0 : 2,
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
          fontSize: "0.9rem",
          position: "relative",
          overflow: "auto",
        }}
      >
        <IconButton
          size="small"
          onClick={handleCopy}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            color: "grey.400",
            bgcolor: "rgba(0,0,0,0.3)",
            "&:hover": {
              bgcolor: "rgba(0,0,0,0.5)",
              color: "white",
            },
            width: 30,
            height: 30,
          }}
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
        <Tooltip open={copied} title="已复制!" placement="top" arrow>
          <Box sx={{ position: "absolute", top: 8, right: 8 }}></Box>
        </Tooltip>
        <pre style={{ margin: 0, overflow: "auto", maxHeight: "400px" }}>
          <code>{code}</code>
        </pre>
      </Paper>
    </Card>
  );
}

interface ConceptCardProps {
  title: string;
  explanation: string;
  examples?: string[];
}

/**
 * 增强的概念卡片组件
 */
export function EnhancedConceptCard({
  title,
  explanation,
  examples = [],
}: ConceptCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card
      sx={{
        mb: 3,
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: expanded ? 3 : 1,
      }}
    >
      <Box
        sx={{
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          bgcolor: expanded ? "primary.light" : "background.default",
          color: expanded ? "primary.contrastText" : "text.primary",
          transition: "background-color 0.3s ease",
        }}
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: "pointer" }}
      >
        <Typography variant="h6" fontWeight={expanded ? "bold" : "medium"}>
          {title}
        </Typography>
        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </Box>
      <Collapse in={expanded}>
        <CardContent>
          <ReactMarkdown>{explanation}</ReactMarkdown>

          {examples.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <LightbulbIcon color="primary" sx={{ mr: 1, fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight="bold">
                  示例:
                </Typography>
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {examples.map((example, index) => (
                  <Chip
                    key={index}
                    label={example}
                    size="small"
                    sx={{
                      bgcolor: "background.paper",
                      border: "1px solid",
                      borderColor: "primary.light",
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Collapse>
    </Card>
  );
}

interface ContentDisplayProps {
  title?: string;
  summary?: string;
  concepts?: {
    title: string;
    explanation: string;
    examples: string[];
  }[];
  codeExamples?: {
    title: string;
    code: string;
    explanation: string;
    language?: string;
  }[];
  faq?: {
    question: string;
    answer: string;
  }[];
  onFeedback?: () => void;
  content?: any;
}

/**
 * 增强的内容展示组件
 */
export default function ContentDisplay({
  title,
  summary,
  concepts,
  codeExamples,
  faq = [],
  onFeedback,
  content,
}: ContentDisplayProps) {
  const displayTitle = title || (content && content.title) || "";
  const displaySummary = summary || (content && content.summary) || "";
  const displayConcepts = concepts || (content && content.concepts) || [];
  const displayCodeExamples =
    codeExamples || (content && content.codeExamples) || [];
  const displayFaq = faq.length > 0 ? faq : (content && content.faq) || [];

  // 定义类型，用于数组映射函数
  type Concept = {
    title: string;
    explanation: string;
    examples: string[];
  };

  type CodeExample = {
    title: string;
    code: string;
    explanation: string;
    language?: string;
  };

  type FaqItem = {
    question: string;
    answer: string;
  };

  return (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 2,
        }}
      >
        <Typography
          variant="h5"
          gutterBottom
          fontWeight="bold"
          color="primary.main"
        >
          {displayTitle || "概述"}
        </Typography>
        {onFeedback && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<LightbulbIcon />}
            onClick={onFeedback}
          >
            内容反馈
          </Button>
        )}
      </Box>

      <Typography
        variant="body1"
        paragraph
        sx={{
          fontSize: "1.05rem",
          lineHeight: 1.6,
          color: "text.primary",
          mb: 3,
        }}
      >
        {displaySummary}
      </Typography>

      {displayConcepts.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />

          <Typography
            variant="h5"
            gutterBottom
            fontWeight="bold"
            color="primary.main"
          >
            核心概念
          </Typography>

          {displayConcepts.map((concept: Concept, index: number) => (
            <EnhancedConceptCard
              key={index}
              title={concept.title}
              explanation={concept.explanation}
              examples={concept.examples}
            />
          ))}
        </>
      )}

      {displayCodeExamples.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography
            variant="h5"
            gutterBottom
            fontWeight="bold"
            color="primary.main"
          >
            代码示例
          </Typography>

          {displayCodeExamples.map((example: CodeExample, index: number) => (
            <Box key={index} sx={{ mb: 4 }}>
              <EnhancedCodeBlock
                title={example.title}
                code={example.code}
                language={example.language}
              />
              <Typography variant="body2" sx={{ mt: 1, px: 1 }}>
                {example.explanation}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {displayFaq.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography
            variant="h5"
            gutterBottom
            fontWeight="bold"
            color="primary.main"
          >
            常见问题
          </Typography>

          {displayFaq.map((item: FaqItem, index: number) => (
            <Card
              key={index}
              sx={{
                mb: 3,
                borderRadius: 2,
                borderLeft: "4px solid",
                borderColor: "secondary.main",
              }}
            >
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  color="secondary.main"
                  fontWeight="medium"
                >
                  {item.question}
                </Typography>
                <Typography variant="body1">{item.answer}</Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Paper>
  );
}
