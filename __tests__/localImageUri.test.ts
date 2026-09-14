import { Platform } from 'react-native';
import { toDisplayableImageUri } from '../src/utils/localImageUri';

describe('toDisplayableImageUri', () => {
  afterEach(() => {
    (Platform as any).OS = 'ios';
  });

  it('Android에서 스킴 없는 절대 경로에는 file:// 스킴을 붙인다 (ISSUE-254)', () => {
    (Platform as any).OS = 'android';
    expect(toDisplayableImageUri('/data/user/0/app.mannadev.meditation/files/widget_design_background_sermon.jpg')).toBe(
      'file:///data/user/0/app.mannadev.meditation/files/widget_design_background_sermon.jpg',
    );
  });

  it('Android에서도 이미 스킴이 있는 경로는 그대로 둔다', () => {
    (Platform as any).OS = 'android';
    expect(toDisplayableImageUri('file:///data/user/0/app/cache/picked_image.jpg')).toBe(
      'file:///data/user/0/app/cache/picked_image.jpg',
    );
    expect(toDisplayableImageUri('content://media/external/images/1')).toBe(
      'content://media/external/images/1',
    );
  });

  it('iOS에서는 스킴 없는 절대 경로도 그대로 둔다 (RN Image가 로컬 파일로 정상 로드)', () => {
    (Platform as any).OS = 'ios';
    expect(toDisplayableImageUri('/var/mobile/Containers/Data/Application/xyz/widget_design_background.jpg')).toBe(
      '/var/mobile/Containers/Data/Application/xyz/widget_design_background.jpg',
    );
  });
});
