// services/notification.service.ts - Enhanced with ongoing call handling
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, AppState } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    
    // Don't show in-app alert for ongoing call notifications
    if (data.type === 'ongoing_call') {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: true,
      };
    }
    
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

class NotificationService {
  private expoPushToken: string | null = null;
  private currentChatUserId: string | null = null;
  private unreadCounts: Map<string, number> = new Map();
  private appStateListener: any = null;
  private isAppInForeground: boolean = true;
  private callNotificationListener: any = null;
  private notificationResponseListener: any = null;

  /**
   * Initialize notifications
   */
  async initialize(): Promise<void> {
    try {
      // Register for push notifications
      await this.registerForPushNotifications();
      
      // Load unread counts
      await this.loadUnreadCounts();
      
      // Setup app state listener
      this.setupAppStateListener();
      
      // Listen for foreground notifications
      this.setupForegroundListener();
      
      // Setup notification response handling (tapping notifications)
      this.setupNotificationResponseHandler();
      
      console.log('✅ Notification service initialized');
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
    }
  }

  /**
   * Setup notification response handler (handles tapping on notifications)
   */
  private setupNotificationResponseHandler(): void {
    this.notificationResponseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('📱 Notification tapped:', response);
        
        const data = response.notification.request.content.data;
        
        // Handle ongoing call notification - navigate to call screen
        if (data.type === 'ongoing_call' && data.callId) {
          console.log('📞 Returning to ongoing call:', data.callId);
          try {
            router.push(`/call/${data.callId}`);
          } catch (error) {
            console.error('Error navigating to call:', error);
          }
        }
        
        // Handle new call notification
        else if (data.type === 'call' && data.callId) {
          console.log('📞 Incoming call notification tapped:', data.callId);
          // The IncomingCallListener component will handle this
        }
        
        // Handle message notification
        else if (data.type === 'message' && data.senderId) {
          console.log('💬 Message notification tapped from:', data.senderId);
          try {
            router.push(`/chat/${data.senderId}`);
          } catch (error) {
            console.error('Error navigating to chat:', error);
          }
        }
      }
    );
  }

  /**
   * Setup app state listener to track foreground/background state
   */
  private setupAppStateListener(): void {
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      this.isAppInForeground = nextAppState === 'active';
      console.log('📱 App state changed:', nextAppState, 'Foreground:', this.isAppInForeground);
      
      // Handle app foreground events
      if (nextAppState === 'active') {
        this.handleAppForeground();
      }
    });
  }

  /**
   * Handle app foreground events
   */
  private handleAppForeground(): void {
    // Don't clear ongoing call notifications - they should persist
    console.log('📱 App foregrounded - keeping ongoing call notifications');
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

      // Configure Android channels
      if (Platform.OS === 'android') {
        // Channel for calls
        await Notifications.setNotificationChannelAsync('calls', {
          name: 'Calls',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF3B30',
          sound: 'call_ringtone',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        });

        // Channel for ongoing calls
        await Notifications.setNotificationChannelAsync('ongoing_calls', {
          name: 'Ongoing Calls',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0],
          lightColor: '#34C759',
          sound: null,
          enableLights: false,
          enableVibrate: false,
          showBadge: false,
        });

        // Channel for messages
        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#667eea',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
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
      
      const data = notification.request.content.data;
      
      // Handle different notification types
      if (data.type === 'message' && data.senderId) {
        this.incrementUnreadCount(data.senderId as string);
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
      // Don't send if recipient is in the current chat and app is in foreground
      if (recipientId === this.currentChatUserId && this.isAppInForeground) {
        console.log('🔕 Not sending notification - user is in the chat and app is active');
        return;
      }

      // Don't send if app is in foreground (we'll show in-app indicators instead)
      if (this.isAppInForeground && data.type !== 'call' && data.type !== 'ongoing_call') {
        console.log('🔕 Not sending push notification - app is in foreground');
        // Still increment unread count for badge
        if (data.type === 'message' && data.senderId) {
          this.incrementUnreadCount(data.senderId as string);
        }
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

      // Configure notification based on type
      const notificationConfig: any = {
        to: pushToken,
        title,
        body,
        data,
        sound: data.type === 'call' ? 'call_ringtone' : data.type === 'ongoing_call' ? null : 'default',
        badge: this.getTotalUnreadCount(),
        priority: data.type === 'ongoing_call' ? 'high' : 'default',
      };

      // Set Android channel
      if (Platform.OS === 'android') {
        if (data.type === 'call') {
          notificationConfig.channelId = 'calls';
        } else if (data.type === 'ongoing_call') {
          notificationConfig.channelId = 'ongoing_calls';
          notificationConfig.sticky = true;
        } else {
          notificationConfig.channelId = 'messages';
        }
      }

      // iOS specific settings for ongoing calls
      if (Platform.OS === 'ios' && data.type === 'ongoing_call') {
        notificationConfig.categoryId = 'ongoing_call';
      }

      // Send push notification via Expo's API
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationConfig),
      });

      if (response.ok) {
        console.log('✅ Notification sent to:', recipientId);
      } else {
        console.error('❌ Failed to send notification:', await response.text());
      }
    } catch (error) {
      console.error('❌ Error sending notification:', error);
    }
  }

  /**
   * Send call notification
   */
  async sendCallNotification(
    recipientId: string,
    callerName: string,
    callId: string,
    isVideo: boolean
  ): Promise<void> {
    try {
      const title = isVideo ? '📹 Incoming Video Call' : '📞 Incoming Call';
      const body = `From ${callerName}`;
      
      await this.sendNotification(recipientId, title, body, {
        type: 'call',
        callId,
        isVideo,
        callerName,
      });
    } catch (error) {
      console.error('❌ Error sending call notification:', error);
    }
  }

  /**
   * Set current chat (to avoid notifications)
   */
  setCurrentChat(userId: string | null): void {
    this.currentChatUserId = userId;
    console.log('👁️ Current chat set to:', userId);
    
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
        console.log('📊 Loaded unread counts:', Object.fromEntries(this.unreadCounts));
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
      console.log('💾 Saved unread counts:', counts);
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
    console.log(`📈 Incremented unread count for ${userId}: ${current + 1}`);
  }

  /**
   * Clear unread count for a user
   */
  clearUnreadCount(userId: string): void {
    const wasPresent = this.unreadCounts.has(userId);
    this.unreadCounts.delete(userId);
    this.saveUnreadCounts();
    this.updateAppBadge();
    if (wasPresent) {
      console.log(`🗑️ Cleared unread count for ${userId}`);
    }
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
   * Get total unread count across all chats
   */
  getTotalUnreadCount(): number {
    return Array.from(this.unreadCounts.values()).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Update app badge with total unread count
   */
  private async updateAppBadge(): Promise<void> {
    try {
      const total = this.getTotalUnreadCount();
      await Notifications.setBadgeCountAsync(total);
      console.log('🏷️ Updated app badge:', total);
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
      console.log('🧹 Cleared all notifications');
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  /**
   * Clear call-related notifications (except ongoing ones)
   */
  async clearCallNotifications(): Promise<void> {
    try {
      // Get all notifications
      const notifications = await Notifications.getPresentedNotificationsAsync();
      
      // Filter and dismiss incoming call notifications (not ongoing ones)
      for (const notification of notifications) {
        const data = notification.request.content.data;
        if (data.type === 'call') {
          await Notifications.dismissNotificationAsync(notification.request.identifier);
          console.log('🧹 Cleared incoming call notification');
        }
      }
    } catch (error) {
      console.error('Error clearing call notifications:', error);
    }
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
    if (this.callNotificationListener) {
      this.callNotificationListener.remove();
    }
    if (this.notificationResponseListener) {
      this.notificationResponseListener.remove();
    }
  }
}

export default new NotificationService();