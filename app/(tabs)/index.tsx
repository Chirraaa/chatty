// app/(tabs)/index.tsx - Clean minimalistic chats list
import { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Spinner } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
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

export default function ChatsListScreen() {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

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

      <Ionicons name="chevron-forward" size={20} color="#3C3C3E" />
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