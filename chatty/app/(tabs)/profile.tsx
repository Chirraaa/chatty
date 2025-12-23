// app/(tabs)/profile.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Alert, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Layout, Text, Button, Card, Divider, Spinner, Modal, Input } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import authService from '@/services/auth.service';
import { auth } from '@/config/firebase';
import EncryptionMigration from '@/utils/encryption-migration';

export default function ProfileScreen() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const currentUser = auth().currentUser;

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      if (currentUser) {
        console.log('Loading profile for user:', currentUser.uid);
        const profile = await authService.getUserProfile(currentUser.uid);
        console.log('Profile loaded:', profile);
        setUserProfile(profile);
        
        if (!profile) {
          console.warn('Profile is null, user may not have completed registration');
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.signOut();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  const handleResetEncryption = () => {
    Alert.alert(
      'Reset Encryption Keys',
      'This will:\n• Delete ALL your messages\n• Generate new encryption keys\n• Require your password\n\nAre you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => setShowPasswordModal(true),
        },
      ]
    );
  };

  const confirmResetEncryption = async () => {
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'Not authenticated');
      return;
    }

    try {
      setResetting(true);
      
      // Delete all messages
      await EncryptionMigration.deleteAllMyMessages(currentUser.uid);
      
      // Reset encryption with new keys
      await EncryptionMigration.resetEncryption(currentUser.uid, password);
      
      setShowPasswordModal(false);
      setPassword('');
      
      Alert.alert(
        'Success',
        'Encryption keys reset successfully! All old messages have been deleted. You can now send and receive new messages.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error) {
      console.error('Reset encryption error:', error);
      Alert.alert('Error', 'Failed to reset encryption. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <Layout style={styles.container}>
        <View style={styles.header}>
          <Text category='h4'>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Spinner size='large' />
          <Text category='s1' appearance='hint' style={styles.loadingText}>
            Loading profile...
          </Text>
        </View>
      </Layout>
    );
  }

  return (
    <Layout style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Password Modal */}
        <Modal
          visible={showPasswordModal}
          backdropStyle={styles.backdrop}
          onBackdropPress={() => !resetting && setShowPasswordModal(false)}
        >
          <Card disabled={true} style={styles.modal}>
            <Text category='h6' style={styles.modalTitle}>
              Confirm Password
            </Text>
            
            <Text appearance='hint' style={styles.modalDescription}>
              Enter your account password to reset encryption keys
            </Text>

            <Input
              style={styles.passwordInput}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
              disabled={resetting}
            />

            <View style={styles.modalActions}>
              <Button
                appearance='outline'
                status='basic'
                style={styles.modalButton}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                }}
                disabled={resetting}
              >
                Cancel
              </Button>
              
              <Button
                status='danger'
                style={styles.modalButton}
                onPress={confirmResetEncryption}
                disabled={resetting}
              >
                {resetting ? 'Resetting...' : 'Reset Keys'}
              </Button>
            </View>
          </Card>
        </Modal>

        {/* Header */}
        <View style={styles.header}>
          <Text category='h4'>Profile</Text>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text category='h1' style={styles.avatarText}>
              {userProfile?.username?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>

          <Text category='h5' style={styles.username}>
            {userProfile?.username || 'No username set'}
          </Text>

          <Text category='s1' appearance='hint'>
            {currentUser?.email}
          </Text>
        </View>

        {/* Account Info Card */}
        <Card style={styles.card}>
          <Text category='h6' style={styles.cardTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="person-circle-outline" size={24} color="#3366FF" />
            <View style={styles.infoContent}>
              <Text category='s2'>User ID</Text>
              <Text appearance='hint' numberOfLines={1}>
                {currentUser?.uid.substring(0, 20)}...
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#00D68F" />
            <View style={styles.infoContent}>
              <Text category='s2'>Encryption</Text>
              <Text style={styles.encryptionText}>End-to-end encrypted</Text>
            </View>
          </View>
        </Card>

        {/* About Card */}
        <Card style={styles.card}>
          <Text category='h6' style={styles.cardTitle}>About</Text>
          <Text appearance='hint' style={styles.aboutText}>
            This app uses end-to-end encryption. Your messages are encrypted on 
            your device and can only be decrypted by the recipient.
          </Text>
        </Card>

        {/* Danger Zone Card */}
        <Card style={[styles.card, styles.dangerCard]}>
          <Text category='h6' style={styles.dangerTitle}>⚠️ Danger Zone</Text>
          
          <Button
            style={styles.resetButton}
            status='danger'
            appearance='outline'
            onPress={handleResetEncryption}
          >
            Reset Encryption Keys
          </Button>
          <Text appearance='hint' style={styles.dangerText}>
            Use this if you see "🔒 Message encrypted with old keys" errors. 
            This will delete ALL messages and generate new keys.
          </Text>
        </Card>

        {/* Sign Out Button */}
        <Button
          style={styles.signOutButton}
          status='danger'
          onPress={handleSignOut}
        >
          Sign Out
        </Button>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    paddingTop: 20,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#3366FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 40,
  },
  username: {
    marginBottom: 4,
  },
  card: {
    marginVertical: 8,
  },
  cardTitle: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  divider: {
    marginVertical: 12,
  },
  encryptionText: {
    color: '#00D68F',
  },
  aboutText: {
    lineHeight: 20,
  },
  dangerCard: {
    borderColor: '#FF3D71',
    borderWidth: 1,
  },
  dangerTitle: {
    marginBottom: 12,
    color: '#FF3D71',
  },
  resetButton: {
    marginBottom: 12,
  },
  dangerText: {
    lineHeight: 18,
    fontSize: 12,
  },
  signOutButton: {
    marginTop: 16,
    marginBottom: 32,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    width: 320,
  },
  modalTitle: {
    marginBottom: 8,
  },
  modalDescription: {
    marginBottom: 16,
    lineHeight: 20,
  },
  passwordInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});