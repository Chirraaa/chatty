// app/chat/[userId].tsx - Fixed call handling with better error logging
import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  FlatList,
  View,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { ChatInput } from '@/components/chat-input';
import { MessageBubble } from '@/components/message-bubble';
import messageService, { Message } from '@/services/message.service';
import authService from '@/services/auth.service';
import callService from '@/services/call.service';
import chatSettingsService from '@/services/chat-settings.service';

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [customNickname, setCustomNickname] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!userId) return;

    loadUserProfile();
    loadChatSettings();
    
    const unsubscribe = messageService.subscribeToMessages(
      userId,
      (newMessages) => {
        setMessages(newMessages);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => unsubscribe();
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
    if (isInitiatingCall) {
      console.log('⏳ Call already in progress...');
      return;
    }

    try {
      setIsInitiatingCall(true);
      console.log('📞 Starting voice call to:', userId);
      
      const callId = await callService.createCall(userId, false);
      console.log('✅ Call created with ID:', callId);
      
      console.log('🚀 Navigating to call screen...');
      router.push(`/call/${callId}`);
    } catch (error: any) {
      console.error('❌ Error starting voice call:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      
      Alert.alert(
        'Call Failed',
        error.message || 'Unable to start voice call. Please check permissions and try again.'
      );
    } finally {
      setIsInitiatingCall(false);
    }
  };

  const handleVideoCall = async () => {
    if (isInitiatingCall) {
      console.log('⏳ Call already in progress...');
      return;
    }

    try {
      setIsInitiatingCall(true);
      console.log('📹 Starting video call to:', userId);
      
      const callId = await callService.createCall(userId, true);
      console.log('✅ Call created with ID:', callId);
      
      console.log('🚀 Navigating to call screen...');
      router.push(`/call/${callId}`);
    } catch (error: any) {
      console.error('❌ Error starting video call:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      
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

  const displayName = customNickname || userProfile?.username || 'Chat';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
        {/* Custom Header */}
        <View style={styles.header}>
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
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
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
        </View>

        {/* Messages */}
        <View style={styles.content}>
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
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            showsVerticalScrollIndicator={false}
          />

          <ChatInput
            receiverId={userId}
            onSendComplete={() => {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            }}
          />
        </View>
      </View>
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
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
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
    backgroundColor: '#667eea',
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
  content: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    paddingBottom: 80,
  },
});