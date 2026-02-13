import { Linking, Share } from 'react-native';

export async function shareEmail(subject: string, body: string): Promise<boolean> {
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    const canMail = await Linking.canOpenURL(mailto);
    if (canMail) {
      await Linking.openURL(mailto);
      return true;
    }
  } catch {}

  try {
    await Share.share({
      title: subject,
      message: body,
    });
    return true;
  } catch {}

  return false;
}
