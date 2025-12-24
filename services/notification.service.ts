// services/notification.service.ts - Push notifications and badge management
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;
  private currentChatUserId: string | null = null;
  private unreadCounts: Map<string, number> = new Map();

  /**
   * Initialize notifications
   */
  async initialize(): Promise<void> {
    try {
      // Register for push notifications
      await this.registerForPushNotifications();
      
      // Load unread counts
      await this.loadUnreadCounts();
      
      // Listen for foreground notifications
      this.setupForegroundListener();
      
      console.log('✅ Notification service initialized');
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
    }
  }

  /**
   * Register for push notifications
   */
  private async registerForPushNotifications(): Promise<void> {
    try {
      if (!Device.isDevice) {
        console.log('📱 Push notifications only work on physical devices');
        return;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Notification permissions not granted');
        return;
      }

      // Get push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      this.expoPushToken = token;
      console.log('✅ Push token:', token);

      // Save token to Firestore
      const currentUser = auth().currentUser;
      if (currentUser) {
        await firestore()
          .collection('users')
          .doc(currentUser.uid)
          .update({
            pushToken: token,
            pushTokenUpdatedAt: firestore.FieldValue.serverTimestamp(),
          });
      }

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#667eea',
        });
      }
    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
    }
  }

  /**
   * Setup foreground notification listener
   */
  private setupForegroundListener(): void {
    Notifications.addNotificationReceivedListener((notification) => {
      console.log('📬 Notification received in foreground:', notification);
      
      // Update badge count
      const data = notification.request.content.data;
      if (data.type === 'message' && data.senderId) {
        this.incrementUnreadCount(data.senderId);
      }
    });
  }

  /**
   * Send notification to user
   */
  async sendNotification(
    recipientId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    try {
      // Don't send if recipient is in the current chat
      if (recipientId === this.currentChatUserId) {
        console.log('🔕 Not sending notification - user is in the chat');
        return;
      }

      // Get recipient's push token
      const recipientDoc = await firestore()
        .collection('users')
        .doc(recipientId)
        .get();
      
      const pushToken = recipientDoc.data()?.pushToken;
      
      if (!pushToken) {
        console.log('📭 No push token for recipient');
        return;
      }

      // Send push notification via Expo's API
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: pushToken,
          title,
          body,
          data,
          sound: 'default',
          badge: 1,
        }),
      });

      console.log('✅ Notification sent to:', recipientId);
    } catch (error) {
      console.error('❌ Error sending notification:', error);
    }
  }

  /**
   * Set current chat (to avoid notifications)
   */
  setCurrentChat(userId: string | null): void {
    this.currentChatUserId = userId;
    
    // Clear unread count for this chat
    if (userId) {
      this.clearUnreadCount(userId);
    }
  }

  /**
   * Load unread counts from storage
   */
  private async loadUnreadCounts(): Promise<void> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const stored = await AsyncStorage.getItem(`unread_counts_${currentUser.uid}`);
      if (stored) {
        const counts = JSON.parse(stored);
        this.unreadCounts = new Map(Object.entries(counts));
      }
    } catch (error) {
      console.error('Error loading unread counts:', error);
    }
  }

  /**
   * Save unread counts to storage
   */
  private async saveUnreadCounts(): Promise<void> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      const counts = Object.fromEntries(this.unreadCounts);
      await AsyncStorage.setItem(
        `unread_counts_${currentUser.uid}`,
        JSON.stringify(counts)
      );
    } catch (error) {
      console.error('Error saving unread counts:', error);
    }
  }

  /**
   * Increment unread count for a user
   */
  incrementUnreadCount(userId: string): void {
    const current = this.unreadCounts.get(userId) || 0;
    this.unreadCounts.set(userId, current + 1);
    this.saveUnreadCounts();
    this.updateAppBadge();
  }

  /**
   * Clear unread count for a user
   */
  clearUnreadCount(userId: string): void {
    this.unreadCounts.delete(userId);
    this.saveUnreadCounts();
    this.updateAppBadge();
  }

  /**
   * Get unread count for a user
   */
  getUnreadCount(userId: string): number {
    return this.unreadCounts.get(userId) || 0;
  }

  /**
   * Get all unread counts
   */
  getAllUnreadCounts(): Map<string, number> {
    return this.unreadCounts;
  }

  /**
   * Update app badge with total unread count
   */
  private async updateAppBadge(): Promise<void> {
    try {
      const total = Array.from(this.unreadCounts.values()).reduce((sum, count) => sum + count, 0);
      await Notifications.setBadgeCountAsync(total);
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  }

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }
}

export default new NotificationService();