// components/message-bubble.tsx - Cleaner message bubbles with gradients
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
          onPress: async (newText: any) => {
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
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.senderAvatarPlaceholder}
            >
              <Text style={styles.senderAvatarText}>
                {senderName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </LinearGradient>
          )}
        </View>
      )}

      <View style={[styles.bubbleContainer, !isSentByMe && showSenderInfo && { marginLeft: 0 }]}>
        {/* Text Message */}
        {message.type === 'text' && message.content && (
          <View style={[
            styles.bubble,
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
            
            {!isSentByMe && !message.decryptionError && (
              <View style={[StyleSheet.absoluteFillObject, styles.receivedBubbleBackground]} />
            )}
            
            <View style={styles.messageContent}>
              <Text style={[
                styles.messageText,
                message.decryptionError && styles.errorText,
              ]}>
                {message.content}
              </Text>
              
              <View style={styles.messageFooter}>
                <Text style={styles.timestamp}>
                  {formatTime(message.timestamp)}
                </Text>
                
                {message.encrypted && !message.decryptionError && (
                  <Text style={styles.encryptedBadge}>🔒</Text>
                )}
                
                {message.edited && !message.decryptionError && (
                  <Text style={styles.editedBadge}>edited</Text>
                )}
              </View>
            </View>
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
            <View style={styles.imageTimestamp}>
              <Text style={styles.imageTimestampText}>
                {formatTime(message.timestamp)}
              </Text>
            </View>
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
    minWidth: 80,
  },
  receivedBubbleBackground: {
    backgroundColor: '#1C1C1E',
  },
  errorBubble: {
    backgroundColor: '#3A1A1A',
    borderWidth: 1,
    borderColor: '#5A2A2A',
  },
  deletedBubble: {
    backgroundColor: '#1C1C1E',
    opacity: 0.6,
  },
  messageContent: {
    gap: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#FFFFFF',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
  },
  deletedText: {
    color: '#8E8E93',
    fontSize: 14,
    fontStyle: 'italic',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  encryptedBadge: {
    fontSize: 10,
    opacity: 0.6,
  },
  editedBadge: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
  },
  imageBubble: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 20,
  },
  imageEncryptedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  encryptedBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  imageTimestamp: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  imageTimestampText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});