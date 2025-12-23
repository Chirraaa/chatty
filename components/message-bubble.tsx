// components/message-bubble.tsx - With edit/delete and proper sizing
import { StyleSheet, View, Image, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { Text } from '@ui-kitten/components';
import { router } from 'expo-router';
import { auth } from '@/config/firebase';
import { Message } from '@/services/message.service';
import messageService from '@/services/message.service';
import { LinearGradient } from 'expo-linear-gradient';

interface MessageBubbleProps {
  message: Message;
  showSenderInfo?: boolean;
  senderName?: string;
  senderPicture?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_WIDTH = SCREEN_WIDTH * 0.75;

export function MessageBubble({ message, showSenderInfo, senderName, senderPicture }: MessageBubbleProps) {
  const currentUserId = auth().currentUser?.uid;
  const isSentByMe = message.senderId === currentUserId;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleLongPress = () => {
    if (message.decryptionError || message.deletedForEveryone) return;

    const options: string[] = [];
    
    if (isSentByMe && message.type === 'text') {
      options.push('Edit');
    }
    
    if (isSentByMe) {
      options.push('Delete for Everyone');
    }
    
    options.push('Delete for Me');
    options.push('Cancel');

    Alert.alert(
      'Message Options',
      '',
      [
        ...(isSentByMe && message.type === 'text' ? [{
          text: 'Edit',
          onPress: () => handleEdit(),
        }] : []),
        ...(isSentByMe ? [{
          text: 'Delete for Everyone',
          onPress: () => handleDeleteForEveryone(),
          style: 'destructive' as const,
        }] : []),
        {
          text: 'Delete for Me',
          onPress: () => handleDeleteForMe(),
          style: 'destructive' as const,
        },
        {
          text: 'Cancel',
          style: 'cancel' as const,
        },
      ]
    );
  };

  const handleEdit = () => {
    Alert.prompt(
      'Edit Message',
      'Enter new message:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async (newText : any) => {
            if (newText && newText.trim()) {
              try {
                await messageService.editMessage(message.id, newText.trim());
              } catch (error) {
                Alert.alert('Error', 'Failed to edit message');
              }
            }
          },
        },
      ],
      'plain-text',
      message.content
    );
  };

  const handleDeleteForMe = async () => {
    try {
      await messageService.deleteMessageForMe(message.id);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const handleDeleteForEveryone = async () => {
    try {
      await messageService.deleteMessageForEveryone(message.id);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const handleImagePress = () => {
    if (message.type === 'image' && message.imageData && !message.decryptionError) {
      router.push({
        pathname: '/image-viewer/[messageId]',
        params: { 
          messageId: message.id,
          imageData: message.imageData,
        },
      });
    }
  };

  if (message.deletedForEveryone) {
    return (
      <View style={[styles.container, isSentByMe ? styles.sentContainer : styles.receivedContainer]}>
        <View style={styles.bubbleContainer}>
          <View style={[styles.bubble, styles.deletedBubble]}>
            <Text style={styles.deletedText}>🚫 This message was deleted</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, isSentByMe ? styles.sentContainer : styles.receivedContainer]}
      onLongPress={handleLongPress}
      activeOpacity={0.9}
      delayLongPress={500}
    >
      {/* Sender Info */}
      {!isSentByMe && showSenderInfo && (
        <View style={styles.senderInfo}>
          {senderPicture ? (
            <Image 
              source={{ uri: `data:image/jpeg;base64,${senderPicture}` }} 
              style={styles.senderAvatar}
            />
          ) : (
            <View style={styles.senderAvatarPlaceholder}>
              <Text style={styles.senderAvatarText}>
                {senderName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={[styles.bubbleContainer, !isSentByMe && showSenderInfo && { marginLeft: 0 }]}>
        {/* Text Message */}
        {message.type === 'text' && message.content && (
          <View style={[
            styles.bubble,
            isSentByMe ? styles.sentBubble : styles.receivedBubble,
            message.decryptionError && styles.errorBubble,
          ]}>
            {isSentByMe && !message.decryptionError && (
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            
            <Text style={[
              styles.messageText,
              isSentByMe ? styles.sentText : styles.receivedText,
              message.decryptionError && styles.errorText,
            ]}>
              {message.content}
            </Text>
            
            {message.encrypted && !message.decryptionError && (
              <Text style={[styles.encryptedBadge, isSentByMe && styles.encryptedBadgeSent]}>
                🔒
              </Text>
            )}

            {message.edited && !message.decryptionError && (
              <Text style={[styles.editedBadge, isSentByMe ? styles.sentText : styles.receivedText]}>
                (edited)
              </Text>
            )}
          </View>
        )}

        {/* Image Message */}
        {message.type === 'image' && message.imageData && !message.decryptionError && (
          <TouchableOpacity 
            style={styles.imageBubble} 
            activeOpacity={0.9}
            onPress={handleImagePress}
            onLongPress={handleLongPress}
            delayLongPress={500}
          >
            <Image
              source={{ uri: message.imageData }}
              style={styles.image}
              resizeMode="cover"
            />
            {message.encrypted && (
              <View style={styles.imageEncryptedBadge}>
                <Text style={styles.encryptedBadgeText}>🔒</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Error State */}
        {message.decryptionError && (
          <View style={[styles.bubble, styles.errorBubble]}>
            <Text style={styles.errorText}>
              {message.type === 'image' ? '🖼️' : '🔒'} Cannot decrypt
            </Text>
          </View>
        )}

        {/* Timestamp */}
        <Text style={[
          styles.timestamp,
          isSentByMe ? styles.sentTimestamp : styles.receivedTimestamp,
        ]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    marginHorizontal: 12,
    flexDirection: 'row',
    alignSelf: 'flex-start',
  },
  sentContainer: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  senderInfo: {
    marginRight: 8,
    marginTop: 4,
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  senderAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bubbleContainer: {
    maxWidth: MAX_WIDTH,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  sentBubble: {
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  receivedBubble: {
    backgroundColor: '#2C2C2E',
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  errorBubble: {
    backgroundColor: '#3A1A1A',
    borderWidth: 1,
    borderColor: '#5A2A2A',
  },
  deletedBubble: {
    backgroundColor: '#2C2C2E',
    opacity: 0.6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  sentText: {
    color: '#FFFFFF',
  },
  receivedText: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
  deletedText: {
    color: '#888888',
    fontSize: 14,
    fontStyle: 'italic',
  },
  encryptedBadge: {
    position: 'absolute',
    bottom: 4,
    right: 8,
    fontSize: 10,
    opacity: 0.6,
  },
  encryptedBadgeSent: {
    opacity: 0.8,
  },
  editedBadge: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
    opacity: 0.7,
  },
  imageBubble: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#2C2C2E',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  imageEncryptedBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  encryptedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  timestamp: {
    marginTop: 4,
    fontSize: 11,
    color: '#8E8E93',
  },
  sentTimestamp: {
    textAlign: 'right',
  },
  receivedTimestamp: {
    textAlign: 'left',
    marginLeft: 4,
  },
});