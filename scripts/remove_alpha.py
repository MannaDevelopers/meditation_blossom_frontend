#!/usr/bin/env python3
import sys
from PIL import Image

def remove_alpha(input_path, output_path):
    # 이미지 로드
    img = Image.open(input_path)
    
    # RGBA 모드인 경우 RGB로 변환 (alpha channel 제거)
    if img.mode in ('RGBA', 'LA'):
        # 흰색 배경으로 합성
        background = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'RGBA':
            background.paste(img, mask=img.split()[3])  # alpha channel을 마스크로 사용
        else:
            background.paste(img)
        img = background
    
    # 이미지 저장
    img.save(output_path, 'PNG', compress_level=9)
    print(f"Successfully removed alpha channel: {output_path}")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python3 remove_alpha.py <input.png> <output.png>")
        sys.exit(1)
    
    remove_alpha(sys.argv[1], sys.argv[2])

