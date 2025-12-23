// app/contact-profile/[userId].tsx - Contact profile with nickname, media, and colors
import { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Text, Button, Spinner, Input } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import authService from '@/services/auth.service';
import messageService, { Message } from '@/services/message.service';
import chatSettingsService from '@/services/chat-settings.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEDIA_SIZE = (SCREEN_WIDTH - 48) / 3;

const BACKGROUND_COLORS = [
  { name: 'Dark', color: '#1A1A1A' },
  { name: 'Deep Blue', color: '#0A1929' },
  { name: 'Dark Purple', color: '#1A0A29' },
  { name: 'Dark Green', color: '#0A291A' },
  { name: 'Dark Red', color: '#290A1A' },
  { name: 'Midnight', color: '#0D1117' },
];

export default function ContactProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [customNickname, setCustomNickname] = useState<string>('');
  const [originalNickname, setOriginalNickname] = useState<string>('');
  const [mediaMessages, setMediaMessages] = useState<Message[]>([]);
  const [selectedColor, setSelectedColor] = useState('#1A1A1A');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
    loadMediaMessages();
    loadChatSettings();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const profile = await authService.getUserProfile(userId);
      setUserProfile(profile);

      const nickname = await authService.getCustomNickname(userId);
      setCustomNickname(nickname || '');
      setOriginalNickname(nickname || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMediaMessages = async () => {
    try {
      const media = await messageService.getMediaMessages(userId);
      setMediaMessages(media);
    } catch (error) {
      console.error('Error loading media:', error);
    }
  };

  const loadChatSettings = async () => {
    try {
      const settings = await chatSettingsService.getChatSettings(userId);
      setSelectedColor(settings.backgroundColor);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSaveNickname = async () => {
    try {
      setSaving(true);
      if (customNickname.trim() !== originalNickname) {
        await authService.setCustomNickname(userId, customNickname.trim());
        setOriginalNickname(customNickname.trim());
        Alert.alert('Success', 'Nickname updated!');
      }
    } catch (error) {
      console.error('Error saving nickname:', error);
      Alert.alert('Error', 'Failed to save nickname');
    } finally {
      setSaving(false);
    }
  };

  const handleColorSelect = async (color: string) => {
    try {
      setSelectedColor(color);
      await chatSettingsService.setChatBackgroundColor(userId, color);
      Alert.alert('Success', 'Chat background updated!');
    } catch (error) {
      console.error('Error setting color:', error);
      Alert.alert('Error', 'Failed to update background');
    }
  };

  const handleMediaPress = (message: Message) => {
    router.push({
      pathname: '/image-viewer/[messageId]',
      params: {
        messageId: message.id,
        imageData: message.imageData,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Spinner size="large" />
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* Header */}
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Info</Text>
        </LinearGradient>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile Section */}
          <View style={styles.profileSection}>
            {userProfile?.profilePicture ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${userProfile.profilePicture}` }}
                style={styles.profilePicture}
              />
            ) : (
              <View style={styles.profilePicturePlaceholder}>
                <Text style={styles.profilePicturePlaceholderText}>
                  {userProfile?.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}

            <Text style={styles.username}>{userProfile?.username || 'Unknown'}</Text>
            <Text style={styles.email}>{userProfile?.email}</Text>
          </View>

          {/* Nickname Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Custom Nickname</Text>
            <Input
              style={styles.input}
              placeholder={userProfile?.username || 'Enter nickname...'}
              placeholderTextColor="#666"
              value={customNickname}
              onChangeText={setCustomNickname}
              disabled={saving}
            />
            {customNickname !== originalNickname && (
              <Button
                style={styles.saveButton}
                onPress={handleSaveNickname}
                disabled={saving}
                size="small"
              >
                {saving ? 'Saving...' : 'Save Nickname'}
              </Button>
            )}
          </View>

          {/* Background Color Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chat Background</Text>
            <View style={styles.colorGrid}>
              {BACKGROUND_COLORS.map((item) => (
                <TouchableOpacity
                  key={item.color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: item.color },
                    selectedColor === item.color && styles.colorOptionSelected,
                  ]}
                  onPress={() => handleColorSelect(item.color)}
                >
                  {selectedColor === item.color && (
                    <Ionicons name="checkmark" size={24} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Media Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Shared Media ({mediaMessages.length})
            </Text>
            
            {mediaMessages.length > 0 ? (
              <View style={styles.mediaGrid}>
                {mediaMessages.map((message) => (
                  <TouchableOpacity
                    key={message.id}
                    style={styles.mediaItem}
                    onPress={() => handleMediaPress(message)}
                  >
                    <Image
                      source={{ uri: message.imageData }}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyMedia}>
                <Ionicons name="images-outline" size={48} color="#666" />
                <Text style={styles.emptyMediaText}>No shared media yet</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#2C2C2E',
    marginBottom: 16,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profilePicturePlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    padding: 16,
    backgroundColor: '#2C2C2E',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#1C1C1E',
  },
  saveButton: {
    marginTop: 8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#667eea',
    borderWidth: 3,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  mediaItem: {
    width: MEDIA_SIZE,
    height: MEDIA_SIZE,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  emptyMedia: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyMediaText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});