// components/message-bubble.tsx - Clean minimal design
import { StyleSheet, View, Image, Dimensions, TouchableOpacity } from 'react-native';
import { Text } from '@ui-kitten/components';
import { auth } from '@/config/firebase';
import { Message } from '@/services/message.service';
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

  return (
    <View style={[styles.container, isSentByMe ? styles.sentContainer : styles.receivedContainer]}>
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
          </View>
        )}

        {/* Image Message */}
        {message.type === 'image' && message.imageData && !message.decryptionError && (
          <TouchableOpacity style={styles.imageBubble} activeOpacity={0.9}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    marginHorizontal: 12,
    maxWidth: MAX_WIDTH,
    flexDirection: 'row',
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
    backgroundColor: '#E1E8ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#657786',
  },
  bubbleContainer: {
    flex: 1,
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    overflow: 'hidden',
  },
  sentBubble: {
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: '#F7F9FA',
    borderBottomLeftRadius: 4,
  },
  errorBubble: {
    backgroundColor: '#FEE',
    borderWidth: 1,
    borderColor: '#FCC',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  sentText: {
    color: '#FFFFFF',
  },
  receivedText: {
    color: '#14171A',
  },
  errorText: {
    color: '#E0245E',
    fontSize: 14,
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
  imageBubble: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F7F9FA',
  },
  image: {
    width: MAX_WIDTH - 32,
    height: MAX_WIDTH - 32,
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
    color: '#657786',
  },
  sentTimestamp: {
    textAlign: 'right',
  },
  receivedTimestamp: {
    textAlign: 'left',
    marginLeft: 4,
  },
});