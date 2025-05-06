'use client';

import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ReactNode } from 'react';

// Create a theme instance with Google Material Design colors
const theme = createTheme({
  palette: {
    primary: {
      main: '#4285F4', // Google Blue
      light: '#80b1ff',
      dark: '#0057c1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#34A853', // Google Green
      light: '#6fd982',
      dark: '#007926',
      contrastText: '#ffffff',
    },
    error: {
      main: '#EA4335', // Google Red
      light: '#ff7961',
      dark: '#b1000c',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#FBBC04', // Google Yellow
      light: '#ffef62',
      dark: '#c49000',
      contrastText: '#000000',
    },
    info: {
      main: '#4285F4', // Google Blue
      light: '#80b1ff',
      dark: '#0057c1',
      contrastText: '#ffffff',
    },
    success: {
      main: '#34A853', // Google Green
      light: '#6fd982',
      dark: '#007926',
      contrastText: '#ffffff',
    },
    background: {
      default: '#FFFFFF',
      paper: '#F8F9FA',
    },
    text: {
      primary: '#202124',
      secondary: '#5F6368',
      disabled: '#9AA0A6',
    },
  },
  typography: {
    fontFamily: [
      'Google Sans',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 4,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

interface ThemeProviderProps {
  children: ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
