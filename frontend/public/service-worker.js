// 定义缓存名称和版本
const CACHE_NAME = 'study-with-me-cache-v1';
const STATIC_CACHE_NAME = 'study-with-me-static-v1';
const API_CACHE_NAME = 'study-with-me-api-v1';
const CONTENT_CACHE_NAME = 'study-with-me-content-v1';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/favicon.ico',
  '/manifest.json',
  // CSS和JS文件会由Next.js自动生成，使用正则匹配这些文件
];

// 需要缓存的API路由
const API_ROUTES = [
  '/api/learning-paths',
  '/api/user',
];

// 安装Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] 安装中');
  
  // 缓存静态资源
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 缓存静态资源');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // 立即激活新的Service Worker，不等待旧的关闭
        return self.skipWaiting();
      })
  );
});

// 激活Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 激活中');
  
  // 清理旧版本缓存
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== STATIC_CACHE_NAME && 
            cacheName !== API_CACHE_NAME && 
            cacheName !== CONTENT_CACHE_NAME
          ) {
            console.log('[Service Worker] 删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // 接管所有客户端，确保激活生效
      return self.clients.claim();
    })
  );
});

// 处理网络请求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 处理静态资源请求
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticAsset(event.request));
    return;
  }
  
  // 处理API请求
  if (isApiRequest(url.pathname)) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }
  
  // 处理学习路径和章节内容请求
  if (isLearningPathRequest(url.pathname)) {
    event.respondWith(handleLearningPathRequest(event.request));
    return;
  }
  
  // 默认处理：网络优先，缓存备用
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 对于导航请求，缓存响应副本
        if (event.request.mode === 'navigate') {
          caches.open(STATIC_CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
          });
        }
        return response;
      })
      .catch(() => {
        // 如果网络请求失败，尝试从缓存中获取
        return caches.match(event.request)
          .then((cacheResponse) => {
            // 如果有缓存，返回缓存
            if (cacheResponse) {
              return cacheResponse;
            }
            
            // 如果是导航请求且没有缓存，返回离线页面
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            
            // 对于其他资源，返回简单的错误响应
            return new Response('Network error happened', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// 处理来自客户端的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_LEARNING_PATH') {
    const { pathId, path } = event.data;
    console.log('[Service Worker] 收到缓存学习路径请求:', pathId);
    
    // 保存学习路径数据到缓存
    caches.open(CONTENT_CACHE_NAME).then((cache) => {
      const url = `/api/learning-paths/${pathId}`;
      const response = new Response(JSON.stringify({ path }), {
        headers: { 'Content-Type': 'application/json' }
      });
      cache.put(url, response);
    });
  }
});

// 处理后台同步
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] 后台同步触发:', event.tag);
  
  if (event.tag === 'sync-learning-progress') {
    event.waitUntil(syncLearningProgress());
  }
});

// 判断是否是静态资源
function isStaticAsset(pathname) {
  return STATIC_ASSETS.includes(pathname) || 
         pathname.startsWith('/_next/') || 
         pathname.endsWith('.js') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.ico');
}

// 判断是否是API请求
function isApiRequest(pathname) {
  return pathname.startsWith('/api/') && 
         API_ROUTES.some(route => pathname.startsWith(route));
}

// 判断是否是学习路径请求
function isLearningPathRequest(pathname) {
  return pathname.match(/\/api\/learning-paths\/([^\/]+)/) ||
         pathname.match(/\/api\/learning-paths\/([^\/]+)\/chapters/) ||
         pathname.match(/\/api\/learning-paths\/([^\/]+)\/chapters\/([^\/]+)/);
}

// 处理静态资源请求
async function handleStaticAsset(request) {
  // 缓存优先策略
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // 如果没有缓存，从网络获取并缓存
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // 如果网络请求失败且无法从缓存获取，返回一个适当的错误响应
    return new Response('静态资源加载失败', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// 处理API请求
async function handleApiRequest(request) {
  // 网络优先，缓存备用
  try {
    const networkResponse = await fetch(request);
    
    // 缓存成功的响应
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] 网络请求失败，尝试从缓存获取:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 如果无法从网络和缓存获取，返回一个适当的错误响应
    return new Response(JSON.stringify({ error: 'Network error', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 处理学习路径请求
async function handleLearningPathRequest(request) {
  // 为已下载的学习路径，优先使用缓存
  const cachedResponse = await caches.match(request);
  
  // 如果有缓存，直接返回
  if (cachedResponse) {
    // 同时在后台刷新缓存
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CONTENT_CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse);
          });
        }
      })
      .catch(error => console.log('[Service Worker] 后台刷新失败:', error));
    
    return cachedResponse;
  }
  
  // 如果没有缓存，从网络获取
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      // 缓存响应
      const cache = await caches.open(CONTENT_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] 学习内容请求失败:', error);
    
    // 如果网络请求失败，尝试从IndexedDB获取数据
    const pathMatch = request.url.match(/\/api\/learning-paths\/([^\/]+)$/);
    const chaptersMatch = request.url.match(/\/api\/learning-paths\/([^\/]+)\/chapters$/);
    const chapterMatch = request.url.match(/\/api\/learning-paths\/([^\/]+)\/chapters\/([^\/]+)$/);
    
    if (pathMatch) {
      // 获取学习路径
      const pathId = pathMatch[1];
      return getPathFromIndexedDB(pathId);
    } else if (chaptersMatch) {
      // 获取章节列表
      const pathId = chaptersMatch[1];
      return getChaptersFromIndexedDB(pathId);
    } else if (chapterMatch) {
      // 获取章节内容
      const pathId = chapterMatch[1];
      const chapterId = chapterMatch[2];
      return getChapterFromIndexedDB(pathId, chapterId);
    }
    
    // 如果无法处理，返回错误响应
    return new Response(JSON.stringify({ error: 'Content not available offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 从IndexedDB获取学习路径
async function getPathFromIndexedDB(pathId) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['learningPaths'], 'readonly');
      const store = transaction.objectStore('learningPaths');
      const request = store.get(pathId);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(new Response(JSON.stringify({ path: request.result }), {
            headers: { 'Content-Type': 'application/json' }
          }));
        } else {
          resolve(new Response(JSON.stringify({ error: 'Path not found in offline storage' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get path from IndexedDB'));
      };
    });
  } catch (error) {
    console.error('IndexedDB访问失败:', error);
    return new Response(JSON.stringify({ error: 'Database access error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 从IndexedDB获取章节列表
async function getChaptersFromIndexedDB(pathId) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chapters'], 'readonly');
      const store = transaction.objectStore('chapters');
      const index = store.index('pathId');
      const request = index.getAll(pathId);
      
      request.onsuccess = () => {
        resolve(new Response(JSON.stringify({ chapters: request.result }), {
          headers: { 'Content-Type': 'application/json' }
        }));
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get chapters from IndexedDB'));
      };
    });
  } catch (error) {
    console.error('IndexedDB访问失败:', error);
    return new Response(JSON.stringify({ error: 'Database access error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 从IndexedDB获取章节内容
async function getChapterFromIndexedDB(pathId, chapterId) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['chapters'], 'readonly');
      const store = transaction.objectStore('chapters');
      const request = store.get(chapterId);
      
      request.onsuccess = () => {
        if (request.result && request.result.pathId === pathId) {
          resolve(new Response(JSON.stringify({ chapter: request.result }), {
            headers: { 'Content-Type': 'application/json' }
          }));
        } else {
          resolve(new Response(JSON.stringify({ error: 'Chapter not found in offline storage' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get chapter from IndexedDB'));
      };
    });
  } catch (error) {
    console.error('IndexedDB访问失败:', error);
    return new Response(JSON.stringify({ error: 'Database access error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 打开IndexedDB数据库
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('study-with-me-db', 1);
    
    request.onerror = () => {
      reject(new Error('Failed to open database'));
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // 创建对象存储
      if (!db.objectStoreNames.contains('learningPaths')) {
        db.createObjectStore('learningPaths', { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains('chapters')) {
        const chapterStore = db.createObjectStore('chapters', { keyPath: 'id' });
        chapterStore.createIndex('pathId', 'pathId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('progress')) {
        const progressStore = db.createObjectStore('progress', { keyPath: 'id', autoIncrement: true });
        progressStore.createIndex('userId', 'userId', { unique: false });
        progressStore.createIndex('pathId', 'pathId', { unique: false });
        progressStore.createIndex('chapterId', 'chapterId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('pendingSync')) {
        const syncStore = db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// 同步学习进度
async function syncLearningProgress() {
  try {
    const db = await openDatabase();
    
    // 获取待同步的学习进度记录
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['pendingSync'], 'readonly');
      const store = transaction.objectStore('pendingSync');
      const request = store.getAll();
      
      request.onsuccess = async () => {
        const items = request.result;
        
        if (items.length === 0) {
          console.log('[Service Worker] 没有待同步的数据');
          resolve();
          return;
        }
        
        console.log(`[Service Worker] 同步 ${items.length} 条学习进度记录`);
        
        // 同步每条记录
        for (const item of items) {
          if (item.type === 'PROGRESS') {
            try {
              const response = await fetch('/api/learning-progress/sync', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(item.data)
              });
              
              if (response.ok) {
                // 同步成功，从待同步队列中移除
                await removeFromPendingSync(item.id);
                console.log(`[Service Worker] 同步成功: 项目ID ${item.id}`);
              } else {
                console.error(`[Service Worker] 同步失败: 项目ID ${item.id}`, await response.text());
              }
            } catch (error) {
              console.error(`[Service Worker] 同步失败: 项目ID ${item.id}`, error);
            }
          }
        }
        
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error('Failed to get pending sync items'));
      };
    });
  } catch (error) {
    console.error('[Service Worker] 同步学习进度失败:', error);
  }
}

// 从待同步队列中移除项目
async function removeFromPendingSync(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingSync'], 'readwrite');
    const store = transaction.objectStore('pendingSync');
    const request = store.delete(id);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = () => {
      reject(new Error('Failed to remove item from pending sync'));
    };
  });
} 