import React from 'react';
import { Button } from 'react-native';
import { useAuth } from '../auth/provider';

export default function SignOutButton() {
  const { signOut } = useAuth();
  return <Button title="Sign Out" onPress={signOut} />;
}
