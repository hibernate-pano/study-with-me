const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * Base API client for making requests to the backend
 */
class ApiClient {
  /**
   * Make a GET request
   * @param endpoint The API endpoint
   * @param options Additional fetch options
   * @returns The response data
   */
  async get(endpoint: string, options = {}) {
    return this.request(endpoint, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Make a POST request
   * @param endpoint The API endpoint
   * @param data The request body
   * @param options Additional fetch options
   * @returns The response data
   */
  async post(endpoint: string, data: any, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    });
  }

  /**
   * Make a PUT request
   * @param endpoint The API endpoint
   * @param data The request body
   * @param options Additional fetch options
   * @returns The response data
   */
  async put(endpoint: string, data: any, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    });
  }

  /**
   * Make a DELETE request
   * @param endpoint The API endpoint
   * @param options Additional fetch options
   * @returns The response data
   */
  async delete(endpoint: string, options = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...options,
    });
  }

  /**
   * Make a request to the API
   * @param endpoint The API endpoint
   * @param options The fetch options
   * @returns The response data
   */
  async request(endpoint: string, options = {}) {
    const url = `${API_URL}${endpoint}`;

    // 获取认证令牌
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json();
        return Promise.reject(error);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      return Promise.reject(error);
    }
  }
}

// API client instances for different services
export const api = new ApiClient();

// Auth API
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout', {}),
  getCurrentUser: () => api.get('/auth/me'),
};

// Learning Paths API
export const learningPathsApi = {
  generate: (data: any) => api.post('/learning-paths/generate', data),
  getById: (id: string) => api.get(`/learning-paths/${id}`),
  getUserPaths: () => api.get('/learning-paths/user'),
  getPopularPaths: (limit: number = 3) => api.get(`/learning-paths/popular?limit=${limit}`),
  getChapters: (pathId: string) => api.get(`/learning-paths/${pathId}/chapters`),
  getChapter: (pathId: string, chapterId: string) => api.get(`/learning-paths/${pathId}/chapters/${chapterId}`),
  updatePath: (pathId: string, data: any) => api.put(`/learning-paths/${pathId}`, data),
  deletePath: (pathId: string) => api.delete(`/learning-paths/${pathId}`),
};

// Content API
export const contentApi = {
  generate: (data: any) => api.post('/content/generate', data),
  getById: (id: string) => api.get(`/content/${id}`),
};

// Tutor API
export const tutorApi = {
  chat: (data: any) => api.post('/tutor/chat', data),
  getChatHistory: (userId: string, pathId: string, chapterId: string) =>
    api.get(`/tutor/history/${userId}/${pathId}/${chapterId}`),
  saveChatHistory: (data: any) => api.post('/tutor/history/save', data),
  clearChatHistory: (userId: string, pathId: string, chapterId: string) =>
    api.delete(`/tutor/history/${userId}/${pathId}/${chapterId}`),
  getRecommendedQuestions: (pathId: string, chapterId: string) =>
    api.get(`/tutor/recommended-questions/${pathId}/${chapterId}`),
};

// Progress API
export const progressApi = {
  update: (data: any) => api.post('/progress/update', data),
  getUserProgress: (userId: string, pathId: string) => api.get(`/progress/${userId}/${pathId}`),
  getUserStats: (userId: string) => api.get(`/progress/stats/${userId}`),
  getPathStats: (userId: string, pathId: string) => api.get(`/progress/path-stats/${userId}/${pathId}`),
  getLearningTimeHistory: (userId: string, period: 'day' | 'week' | 'month' = 'week') =>
    api.get(`/progress/time-history/${userId}?period=${period}`),
};

// Exercises API
export const exercisesApi = {
  generate: (data: any) => api.post('/exercises/generate', data),
  getChapterExercises: (chapterId: string) => api.get(`/exercises/chapter/${chapterId}`),
};

// Achievements API
export const achievementsApi = {
  getAll: () => api.get('/achievements'),
  getUserAchievements: (userId: string) => api.get(`/achievements/user/${userId}`),
  checkAchievements: (userId: string) => api.post(`/achievements/check/${userId}`),
};

// Streaks API
export const streaksApi = {
  getUserStreak: (userId: string) => api.get(`/streaks/${userId}`),
  updateStreak: (userId: string) => api.post(`/streaks/${userId}/update`),
  getStreakRewards: (userId: string) => api.get(`/streaks/${userId}/rewards`),
  grantStreakReward: (userId: string, rewardId: string) =>
    api.post(`/streaks/${userId}/rewards/${rewardId}/grant`),
};

// Leaderboard API
export const leaderboardApi = {
  getTimeLeaderboard: (limit: number = 10, period: 'week' | 'month' | 'all' = 'week') =>
    api.get(`/leaderboard/time?limit=${limit}&period=${period}`),
  getCompletionLeaderboard: (limit: number = 10) =>
    api.get(`/leaderboard/completion?limit=${limit}`),
  getStreakLeaderboard: (limit: number = 10) =>
    api.get(`/leaderboard/streak?limit=${limit}`),
  getUserRanking: (userId: string, type: 'time' | 'completion' | 'streak' = 'time', period: 'week' | 'month' | 'all' = 'week') =>
    api.get(`/leaderboard/user/${userId}?type=${type}&period=${period}`),
};

// Diagrams API
export const diagramsApi = {
  generate: (data: any) => api.post('/diagrams/generate', data),
  getChapterDiagrams: (chapterId: string) => api.get(`/diagrams/chapter/${chapterId}`),
  generateMindMap: (data: any) => api.post('/diagrams/mindmap', data),
  generateFlowchart: (data: any) => api.post('/diagrams/flowchart', data),
  generateSequence: (data: any) => api.post('/diagrams/sequence', data),
  generateClass: (data: any) => api.post('/diagrams/class', data),
  generatePie: (data: any) => api.post('/diagrams/pie', data),
  generateBar: (data: any) => api.post('/diagrams/bar', data),
  generateAuto: (data: any) => api.post('/diagrams/auto', data),
};
