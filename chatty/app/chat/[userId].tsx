// app/chat/[userId].tsx
import { useState, useEffect, useRef } from 'react';
import { StyleSheet, FlatList, KeyboardAvoidingView, Platform, View, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Layout, Modal, Card, Text, Input, Button } from '@ui-kitten/components';
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
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!userId) return;
    authService.getUserProfile(userId).then(setUserProfile);
    
    const unsubscribe = messageService.subscribeToMessages(userId, (newMsgs) => {
      setMessages(newMsgs);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => unsubscribe();
  }, [userId]);

  const onSendMessage = async (text: string) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      senderId: currentUser.uid,
      receiverId: userId,
      type: 'text',
      decryptedContent: text,
      timestamp: new Date(),
      isPending: true,
    };

    setMessages(prev => [...prev, optimisticMsg]); // Instant UI update.tsx]
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 0);

    try {
      await messageService.sendTextMessage(userId, text);
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const onSendImage = async (uri: string) => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) return;

    const tempId = `temp-img-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      senderId: currentUser.uid,
      receiverId: userId,
      type: 'image',
      decryptedImageUri: uri, // Use local URI immediately.tsx]
      timestamp: new Date(),
      isPending: true,
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 0);

    try {
      await messageService.sendImageMessage(userId, uri);
    } catch (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Error', 'Failed to send image');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: userProfile?.username || 'Chat' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container} keyboardVerticalOffset={90}>
        <Layout style={styles.container}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={item.isPending ? { opacity: 0.6 } : {}}>
                <MessageBubble message={item} />
              </View>
            )}
            contentContainerStyle={styles.messagesList}
          />
          <ChatInput receiverId={userId} onSend={onSendMessage} onImageSend={onSendImage} />
        </Layout>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, messagesList: { paddingVertical: 8 } });