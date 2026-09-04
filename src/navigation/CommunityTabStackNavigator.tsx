import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommunityTabStackParamList } from '../types';
import CommunityScreen from '../screens/CommunityScreen';
import CommunityDetailScreen from '../screens/CommunityDetailScreen';
import CommunityPostDetailScreen from '../screens/CommunityPostDetailScreen';
import CommunityChatScreen from '../screens/CommunityChatScreen';

const Stack = createNativeStackNavigator<CommunityTabStackParamList>();

export default function CommunityTabStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityMain" component={CommunityScreen} />
      <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} />
      <Stack.Screen name="CommunityPostDetail" component={CommunityPostDetailScreen} />
      <Stack.Screen name="CommunityChat" component={CommunityChatScreen} />
    </Stack.Navigator>
  );
}
