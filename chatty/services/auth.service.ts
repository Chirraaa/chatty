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
            // Create Firebase auth user
            const userCredential = await auth().createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Initialize encryption for this user
            await encryptionService.initialize(user.uid);

            // Generate encryption keys
            console.log('Generating encryption keys...');
            const publicKeys = await encryptionService.generateKeys();

            // Create user profile in Firestore with public key
            await firestore().collection('users').doc(user.uid).set({
                uid: user.uid,
                email,
                username,
                publicKey: publicKeys.publicKey, // Store public key for other users to encrypt messages
                createdAt: firestore.FieldValue.serverTimestamp(),
                searchableUsername: username.toLowerCase(), // For search
            });

            console.log('User created with encryption keys');
            return user;
        } catch (error) {
            console.error('Signup error:', error);
            throw error;
        }
    }

    /**
     * Sign in existing user
     */
    async signIn(email: string, password: string) {
        try {
            const userCredential = await auth().signInWithEmailAndPassword(email, password);

            // Initialize encryption service with user's keys
            await encryptionService.initialize(userCredential.user.uid);

            return userCredential.user;
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    }

    /**
     * Sign out
     */
    async signOut() {
        try {
            await auth().signOut();
        } catch (error) {
            console.error('Sign out error:', error);
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
            console.error('Update profile error:', error);
            throw error;
        }
    }

    /**
     * Get user profile by ID
     */
    async getUserProfile(userId: string) {
        try {
            const doc = await firestore().collection('users').doc(userId).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Get user profile error:', error);
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
            console.error('Search users error:', error);
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

            // Store in a separate collection for custom nicknames
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
            console.error('Set custom nickname error:', error);
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
            console.error('Get custom nickname error:', error);
            return null;
        }
    }
}

export default new AuthService();