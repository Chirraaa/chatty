// app/chat/[userId].tsx - Real-time chat interface with proper notifications
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Spinner } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import messageService, { Message } from '@/services/message.service';
import authService from '@/services/auth.service';
import notificationService from '@/services/notification.service';
import chatSettingsService from '@/services/chat-settings.service';
import MessageBubble from '@/components/message-bubble';
import ChatInput from '@/components/chat-input';

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [customNickname, setCustomNickname] = useState<string>('');
  const [chatBackground, setChatBackground] = useState<string>('#1A1A1A');
  const [isTyping, setIsTyping] = useState(false);
  
  // Real-time subscription reference
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Set current chat to avoid notifications
    notificationService.setCurrentChat(userId);
    
    // Mark messages as read when entering chat
    messageService.markMessagesAsRead(userId);
    
    // Clear unread count for this chat
    notificationService.clearUnreadCount(userId);

    loadChatData();
    setupRealTimeListener();

    return () => {
      // Clear current chat when leaving
      notificationService.setCurrentChat(null);
      
      // Unsubscribe from real-time updates
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [userId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const loadChatData = async () => {
    try {
      setLoading(true);
      
      // Load other user's profile
      const profile = await authService.getUserProfile(userId);
      const nickname = await authService.getCustomNickname(userId);
      const settings = await chatSettingsService.getChatSettings(userId);
      
      setOtherUser(profile);
      setCustomNickname(nickname || '');
      setChatBackground(settings.backgroundColor);
      
    } catch (error) {
      console.error('Error loading chat data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeListener = () => {
    if (!userId) return;

    console.log('🔌 Setting up real-time message listener for chat:', userId);
    
    // Subscribe to real-time messages
    const unsubscribe = messageService.subscribeToMessages(userId, (updatedMessages) => {
      console.log('📬 Real-time messages updated:', updatedMessages.length);
      setMessages(updatedMessages);
      
      // Mark new messages as read if they are from the other user
      const hasNewMessages = updatedMessages.some(msg => 
        !msg.read && msg.senderId === userId
      );
      
      if (hasNewMessages) {
        setTimeout(() => {
          messageService.markMessagesAsRead(userId);
        }, 1000);
      }
    });

    unsubscribeRef.current = unsubscribe;
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    
    try {
      setSending(true);
      await messageService.sendTextMessage(userId, text.trim());
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendImage = async (imageUri: string) => {
    try {
      setSending(true);
      await messageService.sendImageMessage(userId, imageUri);
    } catch (error) {
      console.error('Error sending image:', error);
      Alert.alert('Error', 'Failed to send image');
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    try {
      await messageService.editMessage(messageId, newText);
    } catch (error) {
      console.error('Error editing message:', error);
      Alert.alert('Error', 'Failed to edit message');
    }
  };

  const handleDeleteMessage = async (messageId: string, forEveryone: boolean) => {
    try {
      if (forEveryone) {
        await messageService.deleteMessageForEveryone(messageId);
      } else {
        await messageService.deleteMessageForMe(messageId);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const handleCall = async (isVideo: boolean) => {
    try {
      const callId = await callService.createCall(userId, isVideo);
      router.push(`/call/${callId}`);
    } catch (error) {
      console.error('Error starting call:', error);
      Alert.alert('Error', 'Failed to start call');
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showDate = !previousMessage || 
      item.timestamp.toDateString() !== previousMessage.timestamp.toDateString();
    
    return (
      <>
        {showDate && (
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>
              {formatDate(item.timestamp)}
            </Text>
          </View>
        )}
        <MessageBubble
          message={item}
          onEdit={handleEditMessage}
          onDelete={handleDeleteMessage}
        />
      </>
    );
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderHeader = () => (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={[styles.header, { paddingTop: 60 + insets.top }]}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.headerButton}
      >
        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.headerInfo}>
        {otherUser?.profilePicture ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${otherUser.profilePicture}` }}
            style={styles.headerAvatar}
          />
        ) : (
          <View style={styles.headerAvatarPlaceholder}>
            <Text style={styles.headerAvatarText}>
              {(customNickname || otherUser?.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {customNickname || otherUser?.username || 'Unknown'}
          </Text>
          {customNickname && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              @{otherUser?.username}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity
          onPress={() => handleCall(false)}
          style={styles.headerButton}
        >
          <Ionicons name="call" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleCall(true)}
          style={styles.headerButton}
        >
          <Ionicons name="videocam" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(`/contact-profile/${userId}`)}
          style={styles.headerButton}
        >
          <Ionicons name="information-circle" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  const renderTypingIndicator = () => {
    if (!isTyping) return null;
    
    return (
      <Animated.View
        entering={FadeIn}
        exiting={FadeOut}
        style={styles.typingContainer}
      >
        <View style={styles.typingBubble}>
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: chatBackground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {renderHeader()}

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.bottom + 60}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (flatListRef.current && messages.length > 0) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#8E8E93" />
              <Text style={styles.emptyTitle}>Start a conversation</Text>
              <Text style={styles.emptySubtitle}>
                Send a message to {customNickname || otherUser?.username || 'start chatting'}
              </Text>
            </View>
          }
        />

        {renderTypingIndicator()}

        <ChatInput
          onSendMessage={handleSendMessage}
          onSendImage={handleSendImage}
          disabled={sending}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerButton: {
    padding: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  content: {
    flex: 1,
  },
  messagesContainer: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    backgroundColor: '#1C1C1E',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 4,
    alignSelf: 'flex-start',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
});