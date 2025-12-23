// app/(tabs)/index.tsx
import { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Layout, Text, List, ListItem, Spinner } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import authService from '@/services/auth.service';

interface ChatPreview {
  userId: string;
  username: string;
  customNickname?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

export default function ChatsListScreen() {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = auth().currentUser;
    
    // Don't load chats if user is not authenticated
    if (!currentUser) {
      console.log('👤 No user, skipping chats loading');
      setLoading(false);
      return;
    }

    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      console.log('📱 Loading chats for:', currentUser.uid);

      // Simple approach: Get all messages without complex ordering
      const unsubscribe = firestore()
        .collection('messages')
        .where('senderId', '==', currentUser.uid)
        .onSnapshot(async (snapshot) => {
          try {
            // Also get messages where current user is receiver
            const receiverSnapshot = await firestore()
              .collection('messages')
              .where('receiverId', '==', currentUser.uid)
              .get();

            // Combine both queries
            const allDocs = [...snapshot.docs, ...receiverSnapshot.docs];
            
            // Get unique user IDs
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

            // Load user profiles and custom nicknames
            const chatPreviews: ChatPreview[] = [];
            for (const userId of userIds) {
              const profile = await authService.getUserProfile(userId);
              const customNickname = await authService.getCustomNickname(userId);
              
              if (profile) {
                chatPreviews.push({
                  userId,
                  username: profile.username,
                  customNickname: customNickname || undefined,
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

  const renderAvatar = (item: ChatPreview) => (
    <View style={styles.avatar}>
      <Text category='h6' style={styles.avatarText}>
        {(item.customNickname || item.username).charAt(0).toUpperCase()}
      </Text>
    </View>
  );

  const renderAccessory = () => (
    <Ionicons name="chevron-forward" size={20} color="#8F9BB3" />
  );

  const renderItem = ({ item }: { item: ChatPreview }) => (
    <ListItem
      title={item.customNickname || item.username}
      description={item.customNickname ? `@${item.username}` : undefined}
      accessoryLeft={() => renderAvatar(item)}
      accessoryRight={renderAccessory}
      onPress={() => handleChatPress(item.userId)}
    />
  );

  const renderEmptyComponent = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="#8F9BB3" />
      <Text category='s1' appearance='hint' style={styles.emptyText}>
        No conversations yet
      </Text>
      <Text category='c1' appearance='hint' style={styles.emptySubtext}>
        Go to Contacts to find someone to chat with
      </Text>
    </View>
  );

  if (loading) {
    return (
      <Layout style={styles.container}>
        <View style={styles.header}>
          <Text category='h4'>Chats</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Spinner size='large' />
        </View>
      </Layout>
    );
  }

  return (
    <Layout style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text category='h4'>Chats</Text>
      </View>

      {/* Chats List */}
      {chats.length > 0 ? (
        <List
          data={chats}
          renderItem={renderItem}
          keyExtractor={(item) => item.userId}
        />
      ) : (
        renderEmptyComponent()
      )}
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3366FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    marginTop: 8,
    textAlign: 'center',
  },
});