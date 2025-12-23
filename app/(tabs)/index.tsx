// app/(tabs)/index.tsx - Dark mode chats list
import { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Text, Spinner } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import authService from '@/services/auth.service';

interface ChatPreview {
  userId: string;
  username: string;
  customNickname?: string;
  profilePicture?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ChatsListScreen() {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

      const unsubscribe = firestore()
        .collection('messages')
        .where('senderId', '==', currentUser.uid)
        .onSnapshot(async (snapshot) => {
          try {
            const receiverSnapshot = await firestore()
              .collection('messages')
              .where('receiverId', '==', currentUser.uid)
              .get();

            const allDocs = [...snapshot.docs, ...receiverSnapshot.docs];
            
            const userIds = new Set<string>();
            allDocs.forEach(doc => {
              const data = doc.data();
              if (data.senderId !== currentUser.uid) {
                userIds.add(data.senderId);
              }
              if (data.receiverId !== currentUser.uid) {
                userIds.add(data.receiverId);
              }
            });

            const chatPreviews: ChatPreview[] = [];
            for (const userId of userIds) {
              const profile = await authService.getUserProfile(userId);
              const customNickname = await authService.getCustomNickname(userId);
              
              if (profile) {
                chatPreviews.push({
                  userId,
                  username: profile.username,
                  customNickname: customNickname || undefined,
                  profilePicture: profile.profilePicture,
                  unreadCount: 0,
                });
              }
            }

            setChats(chatPreviews);
            setLoading(false);
          } catch (error) {
            console.error('Error processing messages:', error);
            setLoading(false);
          }
        }, (error) => {
          if (error.cause === 'permission-denied') {
            return;
          }
          console.error('Error in messages listener:', error);
          setLoading(false);
        });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading chats:', error);
      setLoading(false);
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

      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={80} color="#333" />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        Find someone in Contacts to start chatting
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Chats</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <Spinner size='large' />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Chats</Text>
      </LinearGradient>

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
    backgroundColor: '#1A1A1A',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
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
    backgroundColor: '#2C2C2E',
    marginBottom: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  chatUsername: {
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
});