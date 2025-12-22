// app/chat/[userId].tsx
import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  View,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Layout, Text, Input, Button, Modal, Card } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { ChatInput } from '@/components/chat-input';
import { MessageBubble } from '@/components/message-bubble';
import messageService, { Message } from '@/services/message.service';
import authService from '@/services/auth.service';
import callService from '@/services/call.service';

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [customNickname, setCustomNickname] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!userId) return;

    loadUserProfile();
    
    // Subscribe to messages
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
      setNicknameInput(nickname || profile?.username || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSaveNickname = async () => {
    try {
      await authService.setCustomNickname(userId, nicknameInput.trim());
      setCustomNickname(nicknameInput.trim());
      setEditingNickname(false);
      Alert.alert('Success', 'Custom nickname saved!');
    } catch (error) {
      console.error('Error saving nickname:', error);
      Alert.alert('Error', 'Failed to save nickname');
    }
  };

  const handleVoiceCall = async () => {
    try {
      const callId = await callService.createCall(userId, false);
      router.push(`/call/${callId}`);
    } catch (error) {
      console.error('Error starting voice call:', error);
      Alert.alert('Call Failed', 'Unable to start voice call');
    }
  };

  const handleVideoCall = async () => {
    try {
      const callId = await callService.createCall(userId, true);
      router.push(`/call/${callId}`);
    } catch (error) {
      console.error('Error starting video call:', error);
      Alert.alert('Call Failed', 'Unable to start video call');
    }
  };

  const displayName = customNickname || userProfile?.username || 'Chat';

  const HeaderTitle = () => (
    <Button
      appearance='ghost'
      size='small'
      onPress={() => setEditingNickname(true)}
      accessoryLeft={(props) => (
        <View style={styles.headerTitleContent}>
          <Text category='s1' style={styles.headerName}>{displayName}</Text>
          {customNickname && (
            <Text category='c1' appearance='hint'>@{userProfile?.username}</Text>
          )}
        </View>
      )}
    />
  );

  const HeaderRight = () => (
    <View style={styles.headerActions}>
      <Button
        appearance='ghost'
        size='small'
        accessoryLeft={(props) => <Ionicons name="call" size={20} color="#3366FF" />}
        onPress={handleVoiceCall}
      />
      <Button
        appearance='ghost'
        size='small'
        accessoryLeft={(props) => <Ionicons name="videocam" size={20} color="#3366FF" />}
        onPress={handleVideoCall}
      />
      <Button
        appearance='ghost'
        size='small'
        accessoryLeft={(props) => <Ionicons name="create-outline" size={20} color="#3366FF" />}
        onPress={() => setEditingNickname(true)}
      />
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: displayName,
          headerTitle: () => <HeaderTitle />,
          headerRight: () => <HeaderRight />,
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={100}
      >
        <Layout style={styles.container}>
          {/* Nickname Editor Modal */}
          <Modal
            visible={editingNickname}
            backdropStyle={styles.backdrop}
            onBackdropPress={() => setEditingNickname(false)}
          >
            <Card disabled={true} style={styles.modal}>
              <Text category='h6' style={styles.modalTitle}>
                Set Custom Nickname
              </Text>
              
              <Input
                placeholder="Enter nickname..."
                value={nicknameInput}
                onChangeText={setNicknameInput}
                autoFocus
                style={styles.nicknameInput}
              />

              <View style={styles.modalActions}>
                <Button
                  appearance='outline'
                  status='basic'
                  style={styles.modalButton}
                  onPress={() => {
                    setEditingNickname(false);
                    setNicknameInput(customNickname || userProfile?.username || '');
                  }}
                >
                  Cancel
                </Button>
                
                <Button
                  style={styles.modalButton}
                  onPress={handleSaveNickname}
                >
                  Save
                </Button>
              </View>
            </Card>
          </Modal>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          />

          {/* Input */}
          <ChatInput
            receiverId={userId}
            onSendComplete={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
          />
        </Layout>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTitleContent: {
    alignItems: 'center',
  },
  headerName: {
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  messagesList: {
    paddingVertical: 8,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    width: 320,
  },
  modalTitle: {
    marginBottom: 16,
  },
  nicknameInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});