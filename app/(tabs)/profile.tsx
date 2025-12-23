// app/(tabs)/profile.tsx - Dark mode profile
import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Alert, TouchableOpacity, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Text, Button, Spinner } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import authService from '@/services/auth.service';
import profilePictureService from '@/services/profile-picture.service';
import { clearAllMyMessagesAndResetKeys } from '@/utils/clear-messages';
import { auth } from '@/config/firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
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
      <View style={styles.container}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Profile</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <Spinner size='large' />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Profile</Text>
      </LinearGradient>

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

        {/* Security Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#667eea" />
            <Text style={styles.cardTitle}>Security</Text>
          </View>
          <Text style={styles.cardDescription}>
            Your messages are end-to-end encrypted. Even we cannot read them.
          </Text>
        </View>

        {/* Troubleshooting */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="construct" size={20} color="#8E8E93" />
            <Text style={styles.cardTitle}>Troubleshooting</Text>
          </View>
          <Text style={styles.cardDescription}>
            If you see decryption errors, reset your encryption keys to start fresh.
          </Text>
          <Button
            style={styles.resetButton}
            status='warning'
            appearance='outline'
            size='small'
            onPress={handleClearMessages}
            disabled={clearing}
          >
            {clearing ? 'Resetting...' : 'Reset Encryption'}
          </Button>
        </View>

        {/* Sign Out */}
        <Button
          style={styles.signOutButton}
          status='danger'
          appearance='outline'
          onPress={handleSignOut}
        >
          Sign Out
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  profilePictureSection: {
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    padding: 24,
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
    borderColor: '#2C2C2E',
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
  removePictureButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  removePictureText: {
    fontSize: 14,
    color: '#FF453A',
  },
  card: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  resetButton: {
    marginTop: 12,
  },
  signOutButton: {
    marginTop: 24,
    marginBottom: 40,
  },
});