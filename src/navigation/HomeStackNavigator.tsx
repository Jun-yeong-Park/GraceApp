import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MoreStackParamList } from '../types';
import HomeScreen from '../screens/HomeScreen';
import VolunteerScreen from '../screens/VolunteerScreen';
import PrayerScreen from '../screens/PrayerScreen';
import VisitScreen from '../screens/VisitScreen';
import DirectoryScreen from '../screens/DirectoryScreen';
import MemberDetailScreen from '../screens/MemberDetailScreen';
import AdminScreen from '../screens/AdminScreen';
import OfferingScreen from '../screens/OfferingScreen';
import ReceiptScreen from '../screens/ReceiptScreen';
import SermonSummaryScreen from '../screens/SermonSummaryScreen';

const Stack = createNativeStackNavigator<MoreStackParamList>();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Volunteer" component={VolunteerScreen} />
      <Stack.Screen name="Prayer" component={PrayerScreen} />
      <Stack.Screen name="Visit" component={VisitScreen} />
      <Stack.Screen name="Directory" component={DirectoryScreen} />
      <Stack.Screen name="MemberDetail" component={MemberDetailScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
      <Stack.Screen name="Offering" component={OfferingScreen} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} />
      <Stack.Screen name="SermonSummary" component={SermonSummaryScreen} />
    </Stack.Navigator>
  );
}
