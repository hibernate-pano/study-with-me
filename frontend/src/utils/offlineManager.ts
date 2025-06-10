/**
 * 离线管理工具类
 * 处理Service Worker注册、离线状态检测和IndexedDB操作
 */

// 数据库名称和版本
const DB_NAME = "study-with-me-db";
const DB_VERSION = 1;

// 对象存储名称
const STORES = {
  LEARNING_PATHS: "learningPaths",
  CHAPTERS: "chapters",
  PROGRESS: "progress",
  PENDING_SYNC: "pendingSync",
};

// 离线管理器类
class OfflineManager {
  private db: IDBDatabase | null = null;
  private isOnline: boolean = true;
  private offlineListeners: Array<(isOffline: boolean) => void> = [];
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    // 初始化时检查当前网络状态
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

    if (typeof window !== "undefined") {
      // 添加在线/离线事件监听
      window.addEventListener("online", this.handleOnlineStatusChange);
      window.addEventListener("offline", this.handleOnlineStatusChange);
    }
  }

  /**
   * 初始化离线管理器
   */
  public async init(): Promise<void> {
    console.log("初始化离线管理器...");

    // 检查是否支持Service Worker
    if (this.isServiceWorkerSupported()) {
      await this.registerServiceWorker();
    } else {
      console.warn("此浏览器不支持Service Worker，离线功能将不可用");
    }

    // 初始化IndexedDB
    if (this.isIndexedDBSupported()) {
      await this.initDatabase();
    } else {
      console.warn("此浏览器不支持IndexedDB，离线数据存储将不可用");
    }
  }

  /**
   * 检查浏览器是否支持Service Worker
   */
  private isServiceWorkerSupported(): boolean {
    return typeof navigator !== "undefined" && "serviceWorker" in navigator;
  }

  /**
   * 检查浏览器是否支持IndexedDB
   */
  private isIndexedDBSupported(): boolean {
    return typeof window !== "undefined" && "indexedDB" in window;
  }

  /**
   * 注册Service Worker
   */
  private async registerServiceWorker(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js"
      );
      console.log("Service Worker注册成功:", registration.scope);

      // 当Service Worker更新时通知用户
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.log("新版本的Service Worker已安装，请刷新页面以应用更新");
              // 这里可以添加UI通知逻辑
            }
          };
        }
      };
    } catch (error) {
      console.error("Service Worker注册失败:", error);
    }
  }

  /**
   * 初始化IndexedDB数据库
   */
  private initDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("此浏览器不支持IndexedDB"));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("打开IndexedDB失败:", event);
        reject(new Error("无法打开IndexedDB数据库"));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        console.log("IndexedDB连接成功");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建对象存储
        if (!db.objectStoreNames.contains(STORES.LEARNING_PATHS)) {
          db.createObjectStore(STORES.LEARNING_PATHS, { keyPath: "id" });
          console.log("创建学习路径存储");
        }

        if (!db.objectStoreNames.contains(STORES.CHAPTERS)) {
          const chapterStore = db.createObjectStore(STORES.CHAPTERS, {
            keyPath: "id",
          });
          chapterStore.createIndex("pathId", "pathId", { unique: false });
          console.log("创建章节存储");
        }

        if (!db.objectStoreNames.contains(STORES.PROGRESS)) {
          const progressStore = db.createObjectStore(STORES.PROGRESS, {
            keyPath: "id",
            autoIncrement: true,
          });
          progressStore.createIndex("userId", "userId", { unique: false });
          progressStore.createIndex("pathId", "pathId", { unique: false });
          progressStore.createIndex("chapterId", "chapterId", {
            unique: false,
          });
          console.log("创建学习进度存储");
        }

        if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
          const syncStore = db.createObjectStore(STORES.PENDING_SYNC, {
            keyPath: "id",
            autoIncrement: true,
          });
          syncStore.createIndex("timestamp", "timestamp", { unique: false });
          console.log("创建待同步数据存储");
        }
      };
    });

    return this.dbPromise;
  }

  /**
   * 处理在线状态变化
   */
  private handleOnlineStatusChange = () => {
    const newOnlineStatus = navigator.onLine;
    if (this.isOnline !== newOnlineStatus) {
      this.isOnline = newOnlineStatus;
      console.log(`网络状态变更为: ${this.isOnline ? "在线" : "离线"}`);

      // 通知所有监听器
      this.notifyOfflineListeners();

      // 如果恢复在线，尝试同步待处理数据
      if (this.isOnline) {
        this.syncPendingData();
      }
    }
  };

  /**
   * 通知所有离线状态监听器
   */
  private notifyOfflineListeners(): void {
    this.offlineListeners.forEach((listener) => listener(!this.isOnline));
  }

  /**
   * 添加离线状态变化监听器
   */
  public addOfflineListener(
    listener: (isOffline: boolean) => void
  ): () => void {
    this.offlineListeners.push(listener);
    // 立即通知当前状态
    listener(!this.isOnline);

    // 返回取消监听的函数
    return () => {
      this.offlineListeners = this.offlineListeners.filter(
        (l) => l !== listener
      );
    };
  }

  /**
   * 检查当前是否离线
   */
  public isOffline(): boolean {
    return !this.isOnline;
  }

  /**
   * 将学习路径数据保存到IndexedDB
   */
  public async saveLearningPath(path: any): Promise<void> {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.LEARNING_PATHS], "readwrite");
      const store = transaction.objectStore(STORES.LEARNING_PATHS);

      const request = store.put(path);

      request.onsuccess = () => {
        console.log(`学习路径 ${path.id} 已保存到IndexedDB`);

        // 通知Service Worker缓存此路径
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "CACHE_LEARNING_PATH",
            pathId: path.id,
            path: path,
          });
        }

        resolve();
      };

      request.onerror = (event) => {
        console.error("保存学习路径失败:", event);
        reject(new Error("保存学习路径失败"));
      };
    });
  }

  /**
   * 获取保存的学习路径数据
   */
  public async getLearningPath(pathId: string): Promise<any> {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.LEARNING_PATHS], "readonly");
      const store = transaction.objectStore(STORES.LEARNING_PATHS);

      const request = store.get(pathId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error("获取学习路径失败:", event);
        reject(new Error("获取学习路径失败"));
      };
    });
  }

  /**
   * 将章节数据保存到IndexedDB
   */
  public async saveChapter(pathId: string, chapter: any): Promise<void> {
    // 确保章节对象有pathId属性
    const chapterWithPath = {
      ...chapter,
      pathId,
    };

    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CHAPTERS], "readwrite");
      const store = transaction.objectStore(STORES.CHAPTERS);

      const request = store.put(chapterWithPath);

      request.onsuccess = () => {
        console.log(`章节 ${chapter.id} 已保存到IndexedDB`);
        resolve();
      };

      request.onerror = (event) => {
        console.error("保存章节失败:", event);
        reject(new Error("保存章节失败"));
      };
    });
  }

  /**
   * 获取保存的章节数据
   */
  public async getChapter(chapterId: string): Promise<any> {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CHAPTERS], "readonly");
      const store = transaction.objectStore(STORES.CHAPTERS);

      const request = store.get(chapterId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error("获取章节失败:", event);
        reject(new Error("获取章节失败"));
      };
    });
  }

  /**
   * 通过学习路径ID获取所有章节
   */
  public async getChaptersByPathId(pathId: string): Promise<any[]> {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CHAPTERS], "readonly");
      const store = transaction.objectStore(STORES.CHAPTERS);
      const index = store.index("pathId");

      const request = index.getAll(pathId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error("获取章节列表失败:", event);
        reject(new Error("获取章节列表失败"));
      };
    });
  }

  /**
   * 保存学习进度
   */
  public async saveProgress(progress: any): Promise<void> {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROGRESS], "readwrite");
      const store = transaction.objectStore(STORES.PROGRESS);

      // 添加时间戳
      const progressWithTimestamp = {
        ...progress,
        timestamp: new Date().toISOString(),
      };

      const request = store.put(progressWithTimestamp);

      request.onsuccess = () => {
        console.log("学习进度已保存到IndexedDB");

        // 添加到待同步队列
        this.addToPendingSync({
          type: "PROGRESS",
          data: progressWithTimestamp,
        });

        // 如果在线，尝试立即同步
        if (this.isOnline) {
          this.syncPendingData();
        }

        resolve();
      };

      request.onerror = (event) => {
        console.error("保存学习进度失败:", event);
        reject(new Error("保存学习进度失败"));
      };
    });
  }

  /**
   * 获取学习进度
   */
  public async getProgress(
    userId: string,
    pathId: string,
    chapterId: string
  ): Promise<any> {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROGRESS], "readonly");
      const store = transaction.objectStore(STORES.PROGRESS);

      // 使用游标查找匹配的记录
      const request = store.openCursor();
      let foundProgress = null;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const progress = cursor.value;
          if (
            progress.userId === userId &&
            progress.pathId === pathId &&
            progress.chapterId === chapterId
          ) {
            foundProgress = progress;
          }
          cursor.continue();
        } else {
          // 没有更多数据
          resolve(foundProgress);
        }
      };

      request.onerror = (event) => {
        console.error("获取学习进度失败:", event);
        reject(new Error("获取学习进度失败"));
      };
    });
  }

  /**
   * 添加待同步数据
   */
  private async addToPendingSync(item: any): Promise<void> {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_SYNC], "readwrite");
      const store = transaction.objectStore(STORES.PENDING_SYNC);

      const itemWithTimestamp = {
        ...item,
        timestamp: new Date().toISOString(),
      };

      const request = store.add(itemWithTimestamp);

      request.onsuccess = () => {
        console.log("数据已添加到待同步队列");
        resolve();
      };

      request.onerror = (event) => {
        console.error("添加待同步数据失败:", event);
        reject(new Error("添加待同步数据失败"));
      };
    });
  }

  /**
   * 同步待处理数据到服务器
   */
  public async syncPendingData(): Promise<void> {
    if (!this.isOnline) {
      console.log("离线状态，无法同步数据");
      return;
    }

    const db = await this.initDatabase();
    const transaction = db.transaction([STORES.PENDING_SYNC], "readonly");
    const store = transaction.objectStore(STORES.PENDING_SYNC);

    const request = store.getAll();

    request.onsuccess = async () => {
      const pendingItems = request.result;
      if (pendingItems.length === 0) {
        console.log("没有待同步的数据");
        return;
      }

      console.log(`开始同步 ${pendingItems.length} 条待处理数据`);

      // 尝试使用Background Sync API（如果支持）
      if ("serviceWorker" in navigator && "SyncManager" in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register("sync-learning-progress");
          console.log("已注册后台同步任务");
        } catch (error) {
          console.error("注册后台同步失败，尝试手动同步:", error);
          await this.manualSync(pendingItems);
        }
      } else {
        // 回退到手动同步
        await this.manualSync(pendingItems);
      }
    };

    request.onerror = (event) => {
      console.error("获取待同步数据失败:", event);
    };
  }

  /**
   * 手动同步数据到服务器
   */
  private async manualSync(items: any[]): Promise<void> {
    for (const item of items) {
      try {
        if (item.type === "PROGRESS") {
          // 同步学习进度
          const response = await fetch("/api/learning-progress/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(item.data),
          });

          if (response.ok) {
            await this.removePendingItem(item.id);
            console.log(`同步成功: 项目ID ${item.id}`);
          } else {
            console.error(`同步失败: 项目ID ${item.id}`, await response.text());
          }
        }
        // 可以添加其他类型的同步处理
      } catch (error) {
        console.error(`同步数据失败: 项目ID ${item.id}`, error);
      }
    }
  }

  /**
   * 从待同步队列中移除项目
   */
  private async removePendingItem(id: number): Promise<void> {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_SYNC], "readwrite");
      const store = transaction.objectStore(STORES.PENDING_SYNC);

      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        console.error("移除待同步项目失败:", event);
        reject(new Error("移除待同步项目失败"));
      };
    });
  }

  /**
   * 下载学习路径及其所有章节以供离线使用
   */
  public async downloadLearningPath(pathId: string): Promise<void> {
    try {
      // 获取学习路径数据
      const pathResponse = await fetch(`/api/learning-paths/${pathId}`);
      if (!pathResponse.ok) {
        throw new Error(`获取学习路径失败: ${pathResponse.status}`);
      }

      const pathData = await pathResponse.json();

      // 保存学习路径数据到IndexedDB
      await this.saveLearningPath(pathData.path);

      // 获取章节列表
      const chaptersResponse = await fetch(
        `/api/learning-paths/${pathId}/chapters`
      );
      if (!chaptersResponse.ok) {
        throw new Error(`获取章节列表失败: ${chaptersResponse.status}`);
      }

      const chaptersData = await chaptersResponse.json();

      // 保存每个章节数据
      const chapters = chaptersData.chapters || [];
      for (const chapter of chapters) {
        // 获取完整的章节内容
        const chapterResponse = await fetch(
          `/api/learning-paths/${pathId}/chapters/${chapter.id}`
        );
        if (chapterResponse.ok) {
          const chapterData = await chapterResponse.json();
          await this.saveChapter(pathId, chapterData.chapter);
        }
      }

      console.log(`学习路径 ${pathId} 及其所有章节已下载完成`);
      return Promise.resolve();
    } catch (error) {
      console.error("下载学习路径失败:", error);
      return Promise.reject(error);
    }
  }

  /**
   * 下载单个章节以供离线使用
   */
  public async downloadChapter(
    pathId: string,
    chapterId: string
  ): Promise<void> {
    try {
      // 获取章节数据
      const chapterResponse = await fetch(
        `/api/learning-paths/${pathId}/chapters/${chapterId}`
      );
      if (!chapterResponse.ok) {
        throw new Error(`获取章节数据失败: ${chapterResponse.status}`);
      }

      const chapterData = await chapterResponse.json();

      // 保存章节数据到IndexedDB
      await this.saveChapter(pathId, chapterData.chapter);

      console.log(`章节 ${chapterId} 已下载完成`);
      return Promise.resolve();
    } catch (error) {
      console.error("下载章节失败:", error);
      return Promise.reject(error);
    }
  }

  /**
   * 检查是否已下载学习路径
   */
  public async isLearningPathDownloaded(pathId: string): Promise<boolean> {
    try {
      const path = await this.getLearningPath(pathId);
      return !!path;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查是否已下载章节
   */
  public async isChapterDownloaded(chapterId: string): Promise<boolean> {
    try {
      const chapter = await this.getChapter(chapterId);
      return !!chapter;
    } catch (error) {
      return false;
    }
  }

  /**
   * 删除下载的学习路径及其章节
   */
  public async deleteLearningPath(pathId: string): Promise<void> {
    const db = await this.initDatabase();

    // 删除学习路径
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORES.LEARNING_PATHS], "readwrite");
      const store = transaction.objectStore(STORES.LEARNING_PATHS);

      const request = store.delete(pathId);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        console.error("删除学习路径失败:", event);
        reject(new Error("删除学习路径失败"));
      };
    });

    // 删除相关章节
    const chapters = await this.getChaptersByPathId(pathId);
    for (const chapter of chapters) {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORES.CHAPTERS], "readwrite");
        const store = transaction.objectStore(STORES.CHAPTERS);

        const request = store.delete(chapter.id);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = (event) => {
          console.error("删除章节失败:", event);
          reject(new Error("删除章节失败"));
        };
      });
    }

    console.log(`学习路径 ${pathId} 及其所有章节已从离线存储中删除`);
  }

  /**
   * 删除下载的章节
   */
  public async deleteChapter(chapterId: string): Promise<void> {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CHAPTERS], "readwrite");
      const store = transaction.objectStore(STORES.CHAPTERS);

      const request = store.delete(chapterId);

      request.onsuccess = () => {
        console.log(`章节 ${chapterId} 已从离线存储中删除`);
        resolve();
      };

      request.onerror = (event) => {
        console.error("删除章节失败:", event);
        reject(new Error("删除章节失败"));
      };
    });
  }

  /**
   * 获取所有已下载的学习路径
   */
  public async getAllDownloadedPaths(): Promise<any[]> {
    const db = await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.LEARNING_PATHS], "readonly");
      const store = transaction.objectStore(STORES.LEARNING_PATHS);

      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        console.error("获取已下载学习路径失败:", event);
        reject(new Error("获取已下载学习路径失败"));
      };
    });
  }
}

// 创建单例实例
const offlineManager =
  typeof window !== "undefined" ? new OfflineManager() : null;

export default offlineManager;
