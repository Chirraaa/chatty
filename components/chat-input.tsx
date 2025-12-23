// components/chat-input.tsx - Fixed positioning for Android
import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import imageService from '@/services/image.service';
import messageService from '@/services/message.service';

interface ChatInputProps {
  receiverId: string;
  onSendComplete?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ChatInput = ({ receiverId, onSendComplete }: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const insets = useSafeAreaInsets();

  const handleSend = async () => {
    if (message.trim() && !sending) {
      const textToSend = message.trim();
      setMessage('');
      
      try {
        setSending(true);
        await messageService.sendTextMessage(receiverId, textToSend);
        onSendComplete?.();
      } catch (error) {
        console.error('Error sending message:', error);
        setMessage(textToSend);
      } finally {
        setSending(false);
      }
    }
  };

  const handlePickImage = async () => {
    if (sending) return;
    
    try {
      setSending(true);
      const uri = await imageService.selectImageSource();
      if (uri) {
        await messageService.sendImageMessage(receiverId, uri);
        onSendComplete?.();
      }
    } catch (error) {
      console.error('Error sending image:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity 
          onPress={handlePickImage} 
          style={styles.iconButton}
          disabled={sending}
        >
          <Ionicons 
            name="add-circle" 
            size={32} 
            color={sending ? "#666" : "#667eea"} 
          />
        </TouchableOpacity>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#666"
            value={message}
            onChangeText={setMessage}
            multiline={true}
            maxLength={1000}
            editable={!sending}
          />
        </View>

        <TouchableOpacity 
          onPress={handleSend}
          disabled={!message.trim() || sending}
          style={[
            styles.sendButton,
            (!message.trim() || sending) && styles.sendButtonDisabled
          ]}
        >
          <Ionicons 
            name="arrow-up" 
            size={24} 
            color="#FFFFFF" 
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  iconButton: {
    padding: 4,
    marginBottom: 4,
  },
  inputContainer: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  input: {
    fontSize: 16,
    color: '#FFFFFF',
    maxHeight: 80,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#444',
  },
});