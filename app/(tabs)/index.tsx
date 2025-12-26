// app/(tabs)/index.tsx - Real-time updates with proper unread counts (without ordering)
import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Spinner } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import authService from '@/services/auth.service';
import messageService from '@/services/message.service';
import notificationService from '@/services/notification.service';

// Firebase error type interface
interface FirebaseError extends Error {
  code?: string;
}

// Helper function to check if error is a Firebase error
function isFirebaseError(error: any): error is FirebaseError {
  return error && typeof error.code === 'string';
}

interface ChatPreview {
  userId: string;
  username: string;
  customNickname?: string;
  profilePicture?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

export default function ChatsListScreen() {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clear current chat when on chats list
    notificationService.setCurrentChat(null);
    
    const currentUser = auth().currentUser;
    
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const unsubscribe = loadChats();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const loadChats = () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      console.log('📡 Setting up real-time chat list listener...');

      // Create a map to track unique users and their messages
      const usersMap = new Map<string, ChatPreview>();

      const processMessages = async (messages: any[]) => {
        const currentUserId = currentUser.uid;
        
        // Extract unique user IDs
        const userIds = new Set<string>();
        messages.forEach(msg => {
          const data = msg.data();
          if (data.senderId !== currentUserId) {
            userIds.add(data.senderId);
          }
          if (data.receiverId !== currentUserId) {
            userIds.add(data.receiverId);
          }
        });

        // Load profiles and unread counts
        const chatPreviews: ChatPreview[] = [];
        for (const userId of userIds) {
          const profile = await authService.getUserProfile(userId);
          const customNickname = await authService.getCustomNickname(userId);
          const unreadCount = notificationService.getUnreadCount(userId);
          
          if (profile) {
            // Find last message with this user
            const userMessages = messages.filter(msg => {
              const data = msg.data();
              return (data.senderId === userId || data.receiverId === userId);
            });
            
            // Sort messages by timestamp to get the latest
            userMessages.sort((a, b) => {
              const timeA = a.data().timestamp?.toDate()?.getTime() || 0;
              const timeB = b.data().timestamp?.toDate()?.getTime() || 0;
              return timeB - timeA;
            });
            
            const lastMsg = userMessages[0]; // Get latest message
            const lastMsgData = lastMsg?.data();

            chatPreviews.push({
              userId,
              username: profile.username,
              customNickname: customNickname || undefined,
              profilePicture: profile.profilePicture,
              lastMessageTime: lastMsgData?.timestamp?.toDate(),
              unreadCount,
            });
          }
        }

        // Sort by last message time
        chatPreviews.sort((a, b) => {
          const timeA = a.lastMessageTime?.getTime() || 0;
          const timeB = b.lastMessageTime?.getTime() || 0;
          return timeB - timeA;
        });

        setChats(chatPreviews);
        setLoading(false);
      };

      // Real-time listener for sent messages (without orderBy to avoid index requirement)
      const unsubscribe1 = firestore()
        .collection('messages')
        .where('senderId', '==', currentUser.uid)
        .onSnapshot(
          async (sentSnapshot) => {
            console.log('📬 Sent messages updated');
            
            // Get received messages
            const receivedSnapshot = await firestore()
              .collection('messages')
              .where('receiverId', '==', currentUser.uid)
              .get();

            const allMessages = [...sentSnapshot.docs, ...receivedSnapshot.docs];
            await processMessages(allMessages);
          },
          (error) => {
            if (isFirebaseError(error) && error.code !== 'permission-denied') {
              console.error('❌ Error in sent messages listener:', error);
            }
            setLoading(false);
          }
        );

      // Real-time listener for received messages (without orderBy to avoid index requirement)
      const unsubscribe2 = firestore()
        .collection('messages')
        .where('receiverId', '==', currentUser.uid)
        .onSnapshot(
          async (receivedSnapshot) => {
            console.log('📬 Received messages updated');
            
            // Get sent messages
            const sentSnapshot = await firestore()
              .collection('messages')
              .where('senderId', '==', currentUser.uid)
              .get();

            const allMessages = [...sentSnapshot.docs, ...receivedSnapshot.docs];
            await processMessages(allMessages);
          },
          (error) => {
            if (isFirebaseError(error) && error.code !== 'permission-denied') {
              console.error('❌ Error in received messages listener:', error);
            }
            setLoading(false);
          }
        );

      console.log('✅ Chat list listeners active');

      return () => {
        console.log('🔌 Unsubscribing from chat list listeners');
        unsubscribe1?.();
        unsubscribe2?.();
      };
    } catch (error) {
      console.error('Error loading chats:', error);
      setLoading(false);
      return () => {};
    }
  };

  const handleChatPress = (userId: string) => {
    router.push(`/chat/${userId}`);
  };

  const renderChatItem = ({ item }: { item: ChatPreview }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => handleChatPress(item.userId)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      {item.profilePicture ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.profilePicture}` }}
          style={styles.avatar}
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {(item.customNickname || item.username).charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Chat Info */}
      <View style={styles.chatInfo}>
        <Text style={styles.chatName} numberOfLines={1}>
          {item.customNickname || item.username}
        </Text>
        {item.customNickname && (
          <Text style={styles.chatUsername} numberOfLines={1}>
            @{item.username}
          </Text>
        )}
      </View>

      {/* Unread Badge */}
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>
            {item.unreadCount > 9 ? '+9' : item.unreadCount}
          </Text>
        </View>
      )}

      {/* Chevron */}
      {item.unreadCount === 0 && (
        <Ionicons name="chevron-forward" size={20} color="#3C3C3E" />
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="#3C3C3E" />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        Find someone in Contacts to start chatting
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chats</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Spinner size='large' />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      {chats.length > 0 ? (
        <FlatList
          data={chats}
          renderItem={renderChatItem}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderEmptyState()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingTop: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  chatUsername: {
    fontSize: 15,
    color: '#8E8E93',
  },
  unreadBadge: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
});
