import express from 'express';
import supabaseService from '../services/supabaseService';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const data = await supabaseService.createUser(email, password);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: data.user
    });
  } catch (error: any) {
    res.status(400).json({
      message: 'Registration failed',
      error: error.message
    });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Login a user
 * @access Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const data = await supabaseService.signInUser(email, password);
    
    res.status(200).json({
      message: 'Login successful',
      user: data.user,
      session: data.session
    });
  } catch (error: any) {
    res.status(401).json({
      message: 'Login failed',
      error: error.message
    });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Logout a user
 * @access Private
 */
router.post('/logout', async (req, res) => {
  try {
    await supabaseService.signOutUser();
    
    res.status(200).json({
      message: 'Logout successful'
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Logout failed',
      error: error.message
    });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get('/me', async (req, res) => {
  try {
    const user = await supabaseService.getCurrentUser();
    
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    res.status(200).json({
      user
    });
  } catch (error: any) {
    res.status(401).json({
      message: 'Authentication failed',
      error: error.message
    });
  }
});

export = router;
