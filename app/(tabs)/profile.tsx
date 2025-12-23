// app/(tabs)/profile.tsx - Clean minimalistic profile
import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Alert, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button, Spinner } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import authService from '@/services/auth.service';
import profilePictureService from '@/services/profile-picture.service';
import { clearAllMyMessagesAndResetKeys } from '@/utils/clear-messages';
import { auth } from '@/config/firebase';

export default function ProfileScreen() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const insets = useSafeAreaInsets();
  const currentUser = auth().currentUser;

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      if (currentUser) {
        const profile = await authService.getUserProfile(currentUser.uid);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeProfilePicture = async () => {
    try {
      setUploading(true);
      const base64 = await profilePictureService.pickProfilePicture();
      
      if (base64) {
        await profilePictureService.uploadProfilePicture(base64);
        Alert.alert('Success', 'Profile picture updated!');
        await loadProfile();
      }
    } catch (error) {
      console.error('Error changing profile picture:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveProfilePicture = () => {
    Alert.alert(
      'Remove Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await profilePictureService.removeProfilePicture();
              Alert.alert('Success', 'Profile picture removed');
              await loadProfile();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove profile picture');
            }
          },
        },
      ]
    );
  };

  const handleClearMessages = () => {
    Alert.alert(
      'Reset Encryption',
      'This will delete all messages and generate new encryption keys.\n\nContinue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearing(true);
              const deletedCount = await clearAllMyMessagesAndResetKeys();
              Alert.alert('Success', `Deleted ${deletedCount} messages and generated new keys.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to reset encryption');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await authService.signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Spinner size='large' />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Picture Section */}
        <View style={styles.profilePictureSection}>
          <View style={styles.profilePictureContainer}>
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
            
            <TouchableOpacity
              style={styles.changePictureButton}
              onPress={handleChangeProfilePicture}
              disabled={uploading}
            >
              {uploading ? (
                <Spinner size='small' status='control' />
              ) : (
                <Ionicons name="camera" size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.username}>{userProfile?.username || 'Unknown'}</Text>
          <Text style={styles.email}>{currentUser?.email}</Text>

          {userProfile?.profilePicture && (
            <TouchableOpacity onPress={handleRemoveProfilePicture} style={styles.removePictureButton}>
              <Text style={styles.removePictureText}>Remove Picture</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Settings Cards */}
        <View style={styles.settingsSection}>
          {/* Security Card */}
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="shield-checkmark" size={24} color="#34C759" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>End-to-End Encrypted</Text>
              <Text style={styles.cardDescription}>
                Your messages are secure and private
              </Text>
            </View>
          </View>

          {/* Troubleshooting Card */}
          <TouchableOpacity 
            style={styles.card}
            onPress={handleClearMessages}
            disabled={clearing}
            activeOpacity={0.7}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="refresh" size={24} color="#FF9500" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Reset Encryption</Text>
              <Text style={styles.cardDescription}>
                {clearing ? 'Resetting...' : 'Clear messages and generate new keys'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#3C3C3E" />
          </TouchableOpacity>

          {/* Sign Out Card */}
          <TouchableOpacity 
            style={styles.card}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="log-out" size={24} color="#FF3B30" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Sign Out</Text>
              <Text style={styles.cardDescription}>
                End your session
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#3C3C3E" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profilePictureSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  profilePictureContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePicturePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePicturePlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  changePictureButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#000000',
  },
  username: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  email: {
    fontSize: 15,
    color: '#8E8E93',
  },
  removePictureButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  removePictureText: {
    fontSize: 15,
    color: '#FF453A',
  },
  settingsSection: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cardDescription: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 20,
  },
});