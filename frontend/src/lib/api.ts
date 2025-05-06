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
  getUserPaths: (userId: string) => api.get(`/learning-paths/user/${userId}`),
};

// Content API
export const contentApi = {
  generate: (data: any) => api.post('/content/generate', data),
  getById: (id: string) => api.get(`/content/${id}`),
};

// Tutor API
export const tutorApi = {
  chat: (data: any) => api.post('/tutor/chat', data),
};

// Progress API
export const progressApi = {
  update: (data: any) => api.post('/progress/update', data),
  getUserProgress: (userId: string, pathId: string) => api.get(`/progress/${userId}/${pathId}`),
};

// Exercises API
export const exercisesApi = {
  generate: (data: any) => api.post('/exercises/generate', data),
  getChapterExercises: (chapterId: string) => api.get(`/exercises/chapter/${chapterId}`),
};
