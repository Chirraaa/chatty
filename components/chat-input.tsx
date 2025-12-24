// components/chat-input.tsx - Clean input with proper safe area handling
import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import imageService from '@/services/image.service';
import messageService from '@/services/message.service';

interface ChatInputProps {
  receiverId: string;
  onSendComplete?: () => void;
}

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {/* Image Picker Button */}
        <TouchableOpacity 
          onPress={handlePickImage} 
          style={styles.iconButton}
          disabled={sending}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={sending ? ['#3C3C3E', '#3C3C3E'] : ['#667eea', '#764ba2']}
            style={styles.iconButtonGradient}
          >
            <Ionicons 
              name="add" 
              size={24} 
              color="#FFFFFF" 
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* Message Input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#8E8E93"
            value={message}
            onChangeText={setMessage}
            multiline={true}
            maxLength={1000}
            editable={!sending}
          />
        </View>

        {/* Send Button */}
        {message.trim() ? (
          <TouchableOpacity 
            onPress={handleSend}
            disabled={sending}
            style={styles.sendButtonWrapper}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.sendButton}
            >
              <Ionicons 
                name="arrow-up" 
                size={24} 
                color="#FFFFFF" 
              />
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.sendButtonPlaceholder} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#1C1C1E',
    gap: 8,
  },
  iconButton: {
    marginBottom: 4,
  },
  iconButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  input: {
    fontSize: 16,
    color: '#FFFFFF',
    maxHeight: 80,
    minHeight: 20,
  },
  sendButtonWrapper: {
    marginBottom: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonPlaceholder: {
    width: 36,
    height: 36,
  },
});