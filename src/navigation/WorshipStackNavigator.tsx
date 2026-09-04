import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WorshipStackParamList } from '../types';
import WorshipScreen from '../screens/WorshipScreen';
import BulletinDetailScreen from '../screens/BulletinDetailScreen';

const Stack = createNativeStackNavigator<WorshipStackParamList>();

export default function WorshipStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorshipMain" component={WorshipScreen} />
      <Stack.Screen name="BulletinDetail" component={BulletinDetailScreen} />
    </Stack.Navigator>
  );
}
