"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = __importDefault(require("../config"));
/**
 * Service for interacting with Supabase
 */
class SupabaseService {
    constructor() {
        // Regular client with anon key (limited permissions)
        this.supabase = (0, supabase_js_1.createClient)(config_1.default.supabase.url, config_1.default.supabase.key);
        // Service client with service_role key (admin permissions)
        this.serviceClient = (0, supabase_js_1.createClient)(config_1.default.supabase.url, config_1.default.supabase.serviceKey);
    }
    /**
     * Get the Supabase client
     * @returns The Supabase client
     */
    getClient() {
        return this.supabase;
    }
    /**
     * Get the Supabase service client (with admin permissions)
     * @returns The Supabase service client
     */
    getServiceClient() {
        return this.serviceClient;
    }
    /**
     * Create a new user
     * @param email The user's email
     * @param password The user's password
     * @returns The created user
     */
    createUser(email, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.supabase.auth.signUp({
                email,
                password,
            });
            if (error) {
                throw error;
            }
            return data;
        });
    }
    /**
     * Sign in a user
     * @param email The user's email
     * @param password The user's password
     * @returns The signed in user
     */
    signInUser(email, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) {
                throw error;
            }
            return data;
        });
    }
    /**
     * Sign out a user
     */
    signOutUser() {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield this.supabase.auth.signOut();
            if (error) {
                throw error;
            }
        });
    }
    /**
     * Get the current user
     * @returns The current user
     */
    getCurrentUser() {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.supabase.auth.getUser();
            if (error) {
                throw error;
            }
            return data.user;
        });
    }
    /**
     * Create a learning path
     * @param userId The user ID
     * @param pathData The learning path data
     * @returns The created learning path
     */
    createLearningPath(userId, pathData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.supabase
                .from('learning_paths')
                .insert([
                {
                    user_id: userId,
                    title: pathData.title,
                    description: pathData.description,
                    stages: pathData.stages,
                },
            ])
                .select();
            if (error) {
                throw error;
            }
            return data[0];
        });
    }
    /**
     * Get a learning path by ID
     * @param pathId The learning path ID
     * @returns The learning path
     */
    getLearningPath(pathId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.supabase
                .from('learning_paths')
                .select('*')
                .eq('id', pathId)
                .single();
            if (error) {
                throw error;
            }
            return data;
        });
    }
    /**
     * Get all learning paths for a user
     * @param userId The user ID
     * @returns The user's learning paths
     */
    getUserLearningPaths(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.supabase
                .from('learning_paths')
                .select('*')
                .eq('user_id', userId);
            if (error) {
                throw error;
            }
            return data;
        });
    }
    /**
     * Create chapter content
     * @param pathId The learning path ID
     * @param chapterData The chapter data
     * @returns The created chapter
     */
    createChapterContent(pathId, chapterData) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.supabase
                .from('chapter_contents')
                .insert([
                {
                    path_id: pathId,
                    title: chapterData.title,
                    content: chapterData.content,
                },
            ])
                .select();
            if (error) {
                throw error;
            }
            return data[0];
        });
    }
    /**
     * Get chapter content by ID
     * @param chapterId The chapter ID
     * @returns The chapter content
     */
    getChapterContent(chapterId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.supabase
                .from('chapter_contents')
                .select('*')
                .eq('id', chapterId)
                .single();
            if (error) {
                throw error;
            }
            return data;
        });
    }
    /**
     * Create exercises for a chapter
     * @param chapterId The chapter ID
     * @param exercises The exercises data
     * @returns The created exercises
     */
    createExercises(chapterId, exercises) {
        return __awaiter(this, void 0, void 0, function* () {
            const exercisesWithChapterId = exercises.map(exercise => (Object.assign(Object.assign({}, exercise), { chapter_id: chapterId })));
            const { data, error } = yield this.supabase
                .from('exercises')
                .insert(exercisesWithChapterId)
                .select();
            if (error) {
                throw error;
            }
            return data;
        });
    }
    /**
     * Get exercises for a chapter
     * @param chapterId The chapter ID
     * @returns The chapter's exercises
     */
    getChapterExercises(chapterId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.supabase
                .from('exercises')
                .select('*')
                .eq('chapter_id', chapterId);
            if (error) {
                throw error;
            }
            return data;
        });
    }
    /**
     * Update user progress
     * @param userId The user ID
     * @param pathId The learning path ID
     * @param chapterId The chapter ID
     * @param progress The progress data
     * @returns The updated progress
     */
    updateUserProgress(userId, pathId, chapterId, progress) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if progress record exists
            const { data: existingProgress } = yield this.supabase
                .from('user_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('path_id', pathId)
                .eq('chapter_id', chapterId)
                .maybeSingle();
            if (existingProgress) {
                // Update existing progress
                const { data, error } = yield this.supabase
                    .from('user_progress')
                    .update(Object.assign({ completed: progress.completed, last_accessed: new Date().toISOString() }, progress))
                    .eq('id', existingProgress.id)
                    .select();
                if (error) {
                    throw error;
                }
                return data[0];
            }
            else {
                // Create new progress record
                const { data, error } = yield this.supabase
                    .from('user_progress')
                    .insert([
                    Object.assign({ user_id: userId, path_id: pathId, chapter_id: chapterId, completed: progress.completed, last_accessed: new Date().toISOString() }, progress),
                ])
                    .select();
                if (error) {
                    throw error;
                }
                return data[0];
            }
        });
    }
    /**
     * Get user progress
     * @param userId The user ID
     * @param pathId The learning path ID
     * @returns The user's progress
     */
    getUserProgress(userId, pathId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield this.supabase
                .from('user_progress')
                .select('*')
                .eq('user_id', userId)
                .eq('path_id', pathId);
            if (error) {
                throw error;
            }
            return data;
        });
    }
}
exports.default = new SupabaseService();
