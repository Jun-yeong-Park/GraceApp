import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreTabParamList } from '../types';
import MoreScreen from '../screens/MoreScreen';
import AdminScreen from '../screens/AdminScreen';
import DirectoryScreen from '../screens/DirectoryScreen';
import MemberDetailScreen from '../screens/MemberDetailScreen';
import ReceiptScreen from '../screens/ReceiptScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import EulaScreen from '../screens/EulaScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';

const Stack = createNativeStackNavigator<MoreTabParamList>();

export default function MoreTabNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMain" component={MoreScreen} />
      <Stack.Screen name="Admin" component={AdminScreen as any} />
      <Stack.Screen name="Directory" component={DirectoryScreen as any} />
      <Stack.Screen name="MemberDetail" component={MemberDetailScreen as any} />
      <Stack.Screen name="Receipt" component={ReceiptScreen as any} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen as any} />
      <Stack.Screen name="Eula" component={EulaScreen as any} />
      <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen as any} />
    </Stack.Navigator>
  );
}
