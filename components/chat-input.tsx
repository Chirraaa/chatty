// components/chat-input.tsx - Clean minimal input
import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    <View style={styles.container}>
      <TouchableOpacity 
        onPress={handlePickImage} 
        style={styles.iconButton}
        disabled={sending}
      >
        <Ionicons 
          name="add-circle" 
          size={32} 
          color={sending ? "#AAB8C2" : "#667eea"} 
        />
      </TouchableOpacity>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor="#AAB8C2"
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
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
  },
  iconButton: {
    padding: 4,
    marginBottom: 4,
  },
  inputContainer: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: '#F7F9FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  input: {
    fontSize: 16,
    color: '#14171A',
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
    backgroundColor: '#AAB8C2',
  },
});