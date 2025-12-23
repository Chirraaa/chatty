// services/auth.service.ts
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import encryptionService from './encryption.service';

class AuthService {
    /**
     * Sign up new user with encryption keys
     */
    async signUp(email: string, password: string, username: string) {
        try {
            console.log('🔐 Starting signup process...');

            // Create Firebase auth user
            const userCredential = await auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log('✅ Firebase auth user created:', user.uid);

            // Initialize encryption for this user WITH password for cloud backup
            console.log('🔐 Initializing encryption with cloud backup...');
            await encryptionService.initialize(user.uid, password);

            // Generate encryption keys (will be backed up to cloud automatically)
            console.log('🔑 Generating encryption keys...');
            const publicKeys = await encryptionService.generateKeys();
            console.log('✅ Encryption keys generated and backed up');

            // Create user profile in Firestore with public key
            console.log('💾 Creating user profile in Firestore...');
            await firestore().collection('users').doc(user.uid).set({
                uid: user.uid,
                email,
                username,
                publicKey: publicKeys.publicKey,
                createdAt: firestore.FieldValue.serverTimestamp(),
                searchableUsername: username.toLowerCase(),
            });
            console.log('✅ User profile created successfully');

            // Verify profile was created
            const profileDoc = await firestore().collection('users').doc(user.uid).get();
            if (profileDoc.exists) {
                console.log('✅ Profile verification successful');
            } else {
                console.error('❌ Profile verification failed - document does not exist!');
                throw new Error('Failed to create user profile');
            }

            return user;
        } catch (error) {
            console.error('❌ Signup error:', error);
            throw error;
        }
    }

    /**
     * Sign in existing user
     */
    async signIn(email: string, password: string) {
        try {
            console.log('🔐 Signing in...');
            const userCredential = await auth().signInWithEmailAndPassword(email, password);

            // Initialize encryption service with password to restore from cloud if needed
            console.log('🔐 Initializing encryption with cloud restore capability...');
            await encryptionService.initialize(userCredential.user.uid, password);
            console.log('✅ Sign in successful');

            return userCredential.user;
        } catch (error) {
            console.error('❌ Sign in error:', error);
            throw error;
        }
    }

    /**
     * Sign out
     */
    async signOut() {
        try {
            console.log('👋 Signing out...');
            await auth().signOut();
            console.log('✅ Signed out successfully');
        } catch (error) {
            console.error('❌ Sign out error:', error);
            throw error;
        }
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return auth().currentUser;
    }

    /**
     * Update user profile
     */
    async updateProfile(updates: { username?: string; customNickname?: string }) {
        try {
            const user = this.getCurrentUser();
            if (!user) throw new Error('Not authenticated');

            const updateData: any = {};

            if (updates.username) {
                updateData.username = updates.username;
                updateData.searchableUsername = updates.username.toLowerCase();
            }

            if (updates.customNickname !== undefined) {
                updateData.customNickname = updates.customNickname;
            }

            await firestore().collection('users').doc(user.uid).update(updateData);
        } catch (error) {
            console.error('❌ Update profile error:', error);
            throw error;
        }
    }

    /**
     * Get user profile by ID
     */
    async getUserProfile(userId: string) {
        try {
            const doc = await firestore().collection('users').doc(userId).get();
            if (!doc.exists) {
                console.warn(`⚠️ User profile not found for: ${userId}`);
                return null;
            }
            return doc.data();
        } catch (error) {
            console.error('❌ Get user profile error:', error);
            throw error;
        }
    }

    /**
     * Search users by username
     */
    async searchUsers(query: string) {
        try {
            const searchQuery = query.toLowerCase();
            const snapshot = await firestore()
                .collection('users')
                .where('searchableUsername', '>=', searchQuery)
                .where('searchableUsername', '<=', searchQuery + '\uf8ff')
                .limit(20)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
        } catch (error) {
            console.error('❌ Search users error:', error);
            throw error;
        }
    }

    /**
     * Set custom nickname for another user
     */
    async setCustomNickname(otherUserId: string, nickname: string) {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) throw new Error('Not authenticated');

            await firestore()
                .collection('users')
                .doc(currentUser.uid)
                .collection('customNicknames')
                .doc(otherUserId)
                .set({
                    nickname,
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                });
        } catch (error) {
            console.error('❌ Set custom nickname error:', error);
            throw error;
        }
    }

    /**
     * Get custom nickname for another user
     */
    async getCustomNickname(otherUserId: string): Promise<string | null> {
        try {
            const currentUser = this.getCurrentUser();
            if (!currentUser) return null;

            const doc = await firestore()
                .collection('users')
                .doc(currentUser.uid)
                .collection('customNicknames')
                .doc(otherUserId)
                .get();

            return doc.exists ? doc.data()?.nickname : null;
        } catch (error) {
            console.error('❌ Get custom nickname error:', error);
            return null;
        }
    }

    /**
     * Re-initialize encryption after app restart
     * This tries to load from local storage only (no password available)
     */
    async initializeEncryptionOnStartup(userId: string) {
        try {
            await encryptionService.initialize(userId);
        } catch (error) {
            console.warn('⚠️ Could not initialize encryption on startup:', error);
            // This is OK - user will need to sign in again to restore from cloud
        }
    }
}

export default new AuthService();