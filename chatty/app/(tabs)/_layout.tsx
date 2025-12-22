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
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      // Simplified query without orderBy to avoid index requirement
      const unsubscribe = firestore()
        .collection('messages')
        .where('senderId', '==', currentUser.uid)
        .limit(100)
        .onSnapshot(async (snapshot) => {
          const receiverSnapshot = await firestore()
            .collection('messages')
            .where('receiverId', '==', currentUser.uid)
            .limit(100)
            .get();

          const allDocs = [...snapshot.docs, ...receiverSnapshot.docs];
          
          // Sort in memory instead of in query
          allDocs.sort((a, b) => {
            const aTime = a.data().timestamp?.toMillis() || 0;
            const bTime = b.data().timestamp?.toMillis() || 0;
            return bTime - aTime; // Descending order
          });
          
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
                unreadCount: 0,
              });
            }
          }

          setChats(chatPreviews);
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
    <ListItem
      onPress={() => handleChatPress(item.userId)}
      title={item.customNickname || item.username}
      description={item.customNickname ? `@${item.username}` : undefined}
      accessoryLeft={() => (
        <View style={styles.avatar}>
          <Text category='h6' style={styles.avatarText}>
            {(item.customNickname || item.username).charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      accessoryRight={() => (
        <Ionicons name="chevron-forward" size={20} color="#8F9BB3" />
      )}
    />
  );

  if (loading) {
    return (
      <Layout style={styles.loadingContainer}>
        <Spinner size='large' />
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
          renderItem={renderChatItem}
          keyExtractor={(item) => item.userId}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={64} color="#8F9BB3" />
          <Text category='s1' appearance='hint' style={styles.emptyText}>
            No conversations yet
          </Text>
          <Text appearance='hint' style={styles.emptySubtext}>
            Go to Contacts to find someone to chat with
          </Text>
        </View>
      )}
    </Layout>
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
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1F7',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    fontSize: 12,
  },
});