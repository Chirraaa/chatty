// app/(tabs)/profile.tsx
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import authService from '@/services/auth.service';
import { auth } from '@/config/firebase';

export default function ProfileScreen() {
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const currentUser = auth().currentUser;
      if (currentUser) {
        const profile = await authService.getUserProfile(currentUser.uid);
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
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

  const currentUser = auth().currentUser;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <View className="p-4 border-b border-gray-200 dark:border-gray-700">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">
          Profile
        </Text>
      </View>

      {/* Profile Info */}
      <View className="p-6 items-center">
        {/* Avatar */}
        <View className="w-24 h-24 bg-blue-500 rounded-full items-center justify-center mb-4">
          <Text className="text-white text-4xl font-bold">
            {userProfile?.username?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>

        {/* Username */}
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {userProfile?.username || 'Loading...'}
        </Text>

        {/* Email */}
        <Text className="text-gray-600 dark:text-gray-400 text-base">
          {currentUser?.email}
        </Text>
      </View>

      {/* Settings Section */}
      <View className="px-4 mt-4">
        <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 px-2">
          SETTINGS
        </Text>

        {/* Account Info */}
        <View className="bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden">
          <View className="flex-row items-center p-4 border-b border-gray-200 dark:border-gray-700">
            <Ionicons name="person-circle-outline" size={24} color="#6B7280" />
            <View className="ml-3 flex-1">
              <Text className="text-gray-900 dark:text-white font-medium">
                User ID
              </Text>
              <Text className="text-gray-600 dark:text-gray-400 text-sm">
                {currentUser?.uid.substring(0, 20)}...
              </Text>
            </View>
          </View>

          <View className="flex-row items-center p-4">
            <Ionicons name="shield-checkmark-outline" size={24} color="#10B981" />
            <View className="ml-3 flex-1">
              <Text className="text-gray-900 dark:text-white font-medium">
                Encryption
              </Text>
              <Text className="text-green-600 dark:text-green-400 text-sm">
                End-to-end encrypted
              </Text>
            </View>
          </View>
        </View>

        {/* About Section */}
        <Text className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 px-2 mt-6">
          ABOUT
        </Text>

        <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
          <Text className="text-gray-600 dark:text-gray-400 text-sm leading-5">
            This app uses Signal Protocol for end-to-end encryption. Your messages
            are encrypted on your device and can only be decrypted by the recipient.
          </Text>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          className="bg-red-500 rounded-xl py-4 mt-8"
          onPress={handleSignOut}
        >
          <Text className="text-white text-center font-semibold text-base">
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      <View className="h-8" />
    </ScrollView>
  );
}