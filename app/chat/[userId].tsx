// app/chat/[userId].tsx - Enhanced with real-time updates and read receipts
import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  FlatList,
  View,
  Alert,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ChatInput } from '@/components/chat-input';
import { MessageBubble } from '@/components/message-bubble';
import messageService, { Message } from '@/services/message.service';
import authService from '@/services/auth.service';
import callService from '@/services/call.service';
import chatSettingsService from '@/services/chat-settings.service';
import notificationService from '@/services/notification.service';

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [customNickname, setCustomNickname] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!userId) return;

    // Set current chat for notification service
    notificationService.setCurrentChat(userId);

    // Mark messages as read
    messageService.markMessagesAsRead(userId);

    loadUserProfile();
    loadChatSettings();
    
    console.log('📡 Setting up message subscription for user:', userId);
    const unsubscribe = messageService.subscribeToMessages(
      userId,
      (newMessages) => {
        console.log(`📬 Received ${newMessages.length} messages`);
        setMessages(newMessages);
        
        // Mark as read when messages arrive
        setTimeout(() => {
          messageService.markMessagesAsRead(userId);
        }, 500);
        
        // Auto-scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    // Handle app state changes
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground, mark messages as read
        console.log('📱 App came to foreground, marking messages as read');
        messageService.markMessagesAsRead(userId);
      }
      appState.current = nextAppState;
    });

    return () => {
      console.log('🔌 Cleaning up chat screen');
      notificationService.setCurrentChat(null);
      unsubscribe();
      subscription.remove();
    };
  }, [userId]);

  const loadUserProfile = async () => {
    try {
      const profile = await authService.getUserProfile(userId);
      setUserProfile(profile);
      
      const nickname = await authService.getCustomNickname(userId);
      setCustomNickname(nickname);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadChatSettings = async () => {
    try {
      const settings = await chatSettingsService.getChatSettings(userId);
      setBackgroundColor(settings.backgroundColor);
    } catch (error) {
      console.error('Error loading chat settings:', error);
    }
  };

  const handleVoiceCall = async () => {
    if (isInitiatingCall) return;

    try {
      setIsInitiatingCall(true);
      const callId = await callService.createCall(userId, false);
      router.push(`/call/${callId}`);
    } catch (error: any) {
      console.error('❌ Error starting voice call:', error);
      Alert.alert(
        'Call Failed',
        error.message || 'Unable to start voice call. Please check permissions and try again.'
      );
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const handleVideoCall = async () => {
    if (isInitiatingCall) return;

    try {
      setIsInitiatingCall(true);
      const callId = await callService.createCall(userId, true);
      router.push(`/call/${callId}`);
    } catch (error: any) {
      console.error('❌ Error starting video call:', error);
      Alert.alert(
        'Call Failed',
        error.message || 'Unable to start video call. Please check permissions and try again.'
      );
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const handleHeaderPress = () => {
    router.push(`/contact-profile/${userId}`);
  };

  const handleSendComplete = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const displayName = customNickname || userProfile?.username || 'Chat';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
          {/* Custom Header */}
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0.5)']}
            style={styles.header}
          >
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerCenter} onPress={handleHeaderPress}>
              {userProfile?.profilePicture ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${userProfile.profilePicture}` }}
                  style={styles.headerAvatar}
                />
              ) : (
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.headerAvatarPlaceholder}
                >
                  <Text style={styles.headerAvatarText}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
              )}
              <View style={styles.headerInfo}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {displayName}
                </Text>
                {customNickname && (
                  <Text style={styles.headerUsername} numberOfLines={1}>
                    @{userProfile?.username}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity 
                onPress={handleVideoCall} 
                style={styles.headerButton}
                disabled={isInitiatingCall}
              >
                <Ionicons 
                  name="videocam" 
                  size={24} 
                  color={isInitiatingCall ? "#666" : "#FFFFFF"} 
                />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleVoiceCall} 
                style={styles.headerButton}
                disabled={isInitiatingCall}
              >
                <Ionicons 
                  name="call" 
                  size={24} 
                  color={isInitiatingCall ? "#666" : "#FFFFFF"} 
                />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble 
                message={item} 
                senderName={userProfile?.username}
                senderPicture={userProfile?.profilePicture}
              />
            )}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
            }}
          />

          {/* Chat Input */}
          <ChatInput
            receiverId={userId}
            onSendComplete={handleSendComplete}
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerUsername: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  headerButton: {
    padding: 8,
  },
  messagesList: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
});