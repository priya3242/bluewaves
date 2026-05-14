import SmsAndroid from 'react-native-get-sms-android';
import { PermissionsAndroid } from 'react-native';
import { SmsMessage } from './types';

/**
 * Requests the Android SMS permission required to read messages.
 */
export async function requestSmsPermission(): Promise<boolean> {
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS Permission',
        message: 'This app needs access to your SMS messages to track expenses.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn(err);
    return false;
  }
}

/**
 * Fetches SMS messages using filters.
 */
export async function fetchSmsMessages(
  minDate?: number,
  maxDate?: number,
  indexFrom: number = 0,
  maxCount: number = 100
): Promise<SmsMessage[]> {
  return new Promise((resolve, reject) => {
    const filter: any = {
      box: 'inbox', // Only fetch inbox
      indexFrom,
      maxCount,
    };
    
    if (minDate) filter.minDate = minDate;
    if (maxDate) filter.maxDate = maxDate;

    SmsAndroid.list(
      JSON.stringify(filter),
      (fail: string) => {
        reject(new Error(fail));
      },
      (count: number, smsListStr: string) => {
        const arr = JSON.parse(smsListStr) as SmsMessage[];
        resolve(arr);
      }
    );
  });
}
